import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/contractor/settings — Current contractor settings
// ---------------------------------------------------------------------------
router.get('/contractor/settings', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const { data: contractor, error } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', contractorId)
      .single();

    if (error || !contractor) {
      res.status(404).json({ error: 'Contractor not found' });
      return;
    }

    // Strip sensitive fields from the response
    const { stripe_customer_id, fcm_token, ...safe } = contractor;

    res.json(safe);
  } catch (err) {
    console.error('[api] Contractor settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/contractor/settings — Update contractor settings
// ---------------------------------------------------------------------------
router.patch('/contractor/settings', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  const updates = req.body as Record<string, unknown>;

  // Whitelist editable fields
  const allowedFields = [
    'business_name', 'contact_name', 'contact_phone',
    'calendly_url', 'trade_type', 'default_job_value',
    'urgency_threshold_urgent_min', 'urgency_threshold_normal_min',
    'working_hours_start', 'working_hours_end', 'working_days',
    'after_hours_emergency_policy', 'after_hours_ring',
    'timezone', 'locale',
    'caller_lookup_enabled',
    'notification_preferences',
    'voicemail_config',
  ];

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

  // Validate Calendly URL if provided
  if (filtered['calendly_url']) {
    const url = String(filtered['calendly_url']);
    if (!url.startsWith('https://calendly.com/')) {
      res.status(400).json({ error: 'Calendly URL must start with https://calendly.com/' });
      return;
    }
  }

  try {
    const { data: contractor, error } = await supabase
      .from('contractors')
      .update(filtered)
      .eq('id', contractorId)
      .select()
      .single();

    if (error) {
      console.error('[api] Error updating contractor:', error.message);
      res.status(500).json({ error: 'Failed to update settings' });
      return;
    }

    // Strip sensitive fields
    const { stripe_customer_id, fcm_token, ...safe } = contractor;
    res.json(safe);
  } catch (err) {
    console.error('[api] Contractor update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
