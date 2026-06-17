import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { LeadStatus } from '../../types';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/leads — Paginated lead list with optional filters
// Query params: status, search, page (1-indexed), limit
// ---------------------------------------------------------------------------
router.get('/leads', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  const {
    status,
    search,
    page = '1',
    limit = '50',
  } = req.query as Record<string, string | undefined>;

  const pageNum = Math.max(1, parseInt(page || '1', 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit || '50', 10)));
  const offset = (pageNum - 1) * limitNum;

  try {
    // Data query
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('contractor_id', contractorId);

    // Status filter — supports grouped statuses
    if (status && status !== 'all') {
      const statusMap: Record<string, string[]> = {
        missed: ['missed', 'consent_sent'],
        contacted: ['opted_in', 'qualifying', 'qualifying_issue', 'qualifying_urgency', 'qualifying_name', 'booking_sent', 'dnr_alert'],
        booked: ['booked'],
        completed: ['completed', 'followed_up'],
      };
      const statuses = statusMap[status] || [status];
      query = query.in('status', statuses);
    }

    // Search by phone or name
    if (search && search.trim()) {
      const q = search.trim();
      // Supabase doesn't support OR across columns natively in the builder,
      // so use the .or() filter
      // Sanitize search input — escape PostgREST special characters to prevent filter injection
      const sanitized = q.replace(/[%_,().]/g, '\\$&');
      query = query.or(`caller_phone.ilike.%${sanitized}%,caller_name.ilike.%${sanitized}%`);
    }

    const { data: leads, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      console.error('[api] Error fetching leads:', error.message);
      res.status(500).json({ error: 'Failed to fetch leads' });
      return;
    }

    res.json({
      leads: leads || [],
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum),
    });
  } catch (err) {
    console.error('[api] Leads list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/leads/:id — Single lead with messages
// ---------------------------------------------------------------------------
router.get('/leads/:id', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  const { id } = req.params;

  try {
    // Fetch lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .single();

    if (leadError || !lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Fetch messages
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', id)
      .order('sent_at', { ascending: true });

    // Fetch job costs
    const { data: jobCosts } = await supabase
      .from('job_costs')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    res.json({
      ...lead,
      messages: messages || [],
      job_costs: jobCosts || [],
    });
  } catch (err) {
    console.error('[api] Lead detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/leads/:id — Update lead fields
// Supported fields: status, notes, estimated_value, caller_name
// Special case: status = 'completed' schedules a satisfaction follow-up
// ---------------------------------------------------------------------------
router.patch('/leads/:id', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  const { id } = req.params;
  const updates = req.body as Record<string, unknown>;

  // Whitelist allowed fields
  const allowedFields = ['status', 'notes', 'estimated_value', 'caller_name', 'issue_description'];
  const filtered: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      filtered[key] = updates[key];
    }
  }

  if (Object.keys(filtered).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  filtered['updated_at'] = new Date().toISOString();

  try {
    // Verify the lead belongs to this contractor
    const { data: existing, error: checkErr } = await supabase
      .from('leads')
      .select('id, contractor_id, status')
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .single();

    if (checkErr || !existing) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Update
    const { data: lead, error: updateErr } = await supabase
      .from('leads')
      .update(filtered)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('[api] Error updating lead:', updateErr.message);
      res.status(500).json({ error: 'Failed to update lead' });
      return;
    }

    // If marking as completed, schedule satisfaction follow-up
    if (filtered['status'] === LeadStatus.Completed && existing.status !== LeadStatus.Completed) {
      const followupTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('scheduled_tasks').insert({
        lead_id: id,
        task_type: 'satisfaction_followup',
        execute_at: followupTime,
        executed: false,
      });

      // Set default estimated value if not already set
      if (!lead.estimated_value) {
        const { data: contractor } = await supabase
          .from('contractors')
          .select('default_job_value')
          .eq('id', contractorId)
          .single();

        if (contractor?.default_job_value) {
          await supabase
            .from('leads')
            .update({ estimated_value: contractor.default_job_value })
            .eq('id', id);
        }
      }
    }

    res.json(lead);
  } catch (err) {
    console.error('[api] Lead update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/leads/:id/gdpr — Full GDPR deletion with audit log
// ---------------------------------------------------------------------------
router.delete('/leads/:id/gdpr', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  const { id } = req.params;

  try {
    // Verify ownership
    const { data: lead, error: checkErr } = await supabase
      .from('leads')
      .select('id')
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .single();

    if (checkErr || !lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Delete related records explicitly (cascade handles most, but be thorough)
    await supabase.from('job_costs').delete().eq('lead_id', id);
    await supabase.from('messages').delete().eq('lead_id', id);
    await supabase.from('scheduled_tasks').delete().eq('lead_id', id);
    await supabase.from('leads').delete().eq('id', id);

    // Audit log (no PII)
    await supabase.from('audit_log').insert({
      action: 'gdpr_deletion',
      entity_type: 'lead',
      entity_id: id,
      performed_by: contractorId,
    });

    res.status(200).json({ ok: true, message: 'Lead and all associated data deleted' });
  } catch (err) {
    console.error('[api] GDPR deletion error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
