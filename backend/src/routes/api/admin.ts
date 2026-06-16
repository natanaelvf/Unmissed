import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { notificationService } from '../../services/notifications';
import {
  searchAvailableNumbers,
  purchaseAndAssignNumber,
  releaseNumber,
} from '../../services/twilio-provisioning';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mask a phone number for GDPR-safe display.
 * "+358454901654" → "+358****1654"
 */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return '****';
  return phone.slice(0, 4) + '****' + phone.slice(-4);
}

/**
 * Strip sensitive fields from a contractor object.
 * In admin mode, also mask phone numbers.
 */
function sanitizeContractor(
  contractor: Record<string, unknown>,
  mode: 'admin' | 'dev'
): Record<string, unknown> {
  const { stripe_customer_id, fcm_token, ...safe } = contractor;

  if (mode === 'admin') {
    // Mask phone numbers for GDPR compliance
    if (safe.contact_phone) safe.contact_phone = maskPhone(safe.contact_phone as string);
    if (safe.twilio_phone_number) safe.twilio_phone_number = maskPhone(safe.twilio_phone_number as string);
  }

  return safe;
}

/**
 * Read the dashboard mode from the query string (?mode=admin|dev).
 * Defaults to 'admin' for safety.
 */
function getMode(req: Request): 'admin' | 'dev' {
  return req.query.mode === 'dev' ? 'dev' : 'admin';
}

// ---------------------------------------------------------------------------
// GET /api/admin/contractors — List all contractors
// ---------------------------------------------------------------------------
router.get('/contractors', async (req: Request, res: Response) => {
  const mode = getMode(req);

  try {
    const { data: contractors, error } = await supabase
      .from('contractors')
      .select('id, business_name, contact_name, contact_email, contact_phone, twilio_phone_number, trade_type, tier, locale, active, number_setup_type, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[admin] List contractors error:', error.message);
      res.status(500).json({ error: 'Failed to fetch contractors' });
      return;
    }

    const sanitized = (contractors || []).map((c) => sanitizeContractor(c, mode));
    res.json(sanitized);
  } catch (err) {
    console.error('[admin] List contractors error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/contractors/:id — Single contractor detail
// ---------------------------------------------------------------------------
router.get('/contractors/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const mode = getMode(req);

  try {
    const { data: contractor, error } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !contractor) {
      res.status(404).json({ error: 'Contractor not found' });
      return;
    }

    res.json(sanitizeContractor(contractor, mode));
  } catch (err) {
    console.error('[admin] Get contractor error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/contractors — Create new contractor
// Creates a Supabase Auth user, then inserts the contractor row.
// ---------------------------------------------------------------------------
router.post('/contractors', async (req: Request, res: Response) => {
  const {
    email,
    password,
    business_name,
    contact_name,
    contact_phone,
    twilio_phone_number,
    number_setup_type,
    calendly_url,
    trade_type,
    default_job_value,
    timezone,
    locale,
    tier,
    monthly_sms_cap,
    working_hours_start,
    working_hours_end,
    working_days,
  } = req.body as Record<string, unknown>;

  // Validate required fields
  if (!email || !password || !business_name || !contact_name) {
    res.status(400).json({
      error: 'Missing required fields: email, password, business_name, contact_name',
    });
    return;
  }

  try {
    // 1. Create Supabase Auth user (using the admin/service key)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email as string,
      password: password as string,
      email_confirm: true,
      user_metadata: {
        business_name,
        full_name: contact_name,
      },
    });

    if (authError || !authData.user) {
      console.error('[admin] Auth user creation failed:', authError?.message);
      res.status(400).json({ error: authError?.message || 'Failed to create auth user' });
      return;
    }

    const userId = authData.user.id;

    // 2. The auth trigger (handle_new_user) will auto-create a contractor row,
    //    but it only fills minimal fields. We update it with all the provided data.
    const updates: Record<string, unknown> = {
      business_name,
      contact_name,
      contact_email: email,
      contact_phone: contact_phone || '',
      twilio_phone_number: twilio_phone_number || '',
      number_setup_type: number_setup_type || 'forwarding',
      calendly_url: calendly_url || null,
      trade_type: trade_type || 'other',
      default_job_value: default_job_value || 350,
      timezone: timezone || 'Europe/Helsinki',
      locale: locale || 'fi',
      tier: tier || 'starter',
      monthly_sms_cap: monthly_sms_cap || 50,
      working_hours_start: working_hours_start || '08:00',
      working_hours_end: working_hours_end || '18:00',
      working_days: working_days || [1, 2, 3, 4, 5],
      active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: contractor, error: updateError } = await supabase
      .from('contractors')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('[admin] Contractor update after creation failed:', updateError.message);
      // The auth user was created but contractor update failed — try direct insert
      const { data: inserted, error: insertError } = await supabase
        .from('contractors')
        .upsert({ id: userId, ...updates })
        .select()
        .single();

      if (insertError) {
        console.error('[admin] Contractor upsert failed:', insertError.message);
        res.status(500).json({ error: 'Auth user created but contractor record failed' });
        return;
      }

      res.status(201).json(sanitizeContractor(inserted, 'admin'));
      return;
    }

    console.log(`[admin] Contractor created: ${business_name} (${userId})`);
    res.status(201).json(sanitizeContractor(contractor, 'admin'));
  } catch (err) {
    console.error('[admin] Create contractor error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/contractors/:id — Update contractor settings
// ---------------------------------------------------------------------------
router.patch('/contractors/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body as Record<string, unknown>;

  // Whitelist editable fields (broader than the contractor's own endpoint)
  const allowedFields = [
    'business_name', 'contact_name', 'contact_email', 'contact_phone',
    'twilio_phone_number', 'number_setup_type',
    'calendly_url', 'trade_type', 'default_job_value',
    'urgency_threshold_urgent_min', 'urgency_threshold_normal_min',
    'working_hours_start', 'working_hours_end', 'working_days',
    'after_hours_emergency_policy', 'after_hours_ring',
    'timezone', 'locale', 'tier', 'monthly_sms_cap',
    'caller_lookup_enabled', 'active',
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

  try {
    const { data: contractor, error } = await supabase
      .from('contractors')
      .update(filtered)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[admin] Update contractor error:', error.message);
      res.status(500).json({ error: 'Failed to update contractor' });
      return;
    }

    res.json(sanitizeContractor(contractor, getMode(req)));
  } catch (err) {
    console.error('[admin] Update contractor error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/contractors/:id — Soft-delete (deactivate) a contractor
// ---------------------------------------------------------------------------
router.delete('/contractors/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('contractors')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[admin] Deactivate contractor error:', error.message);
      res.status(500).json({ error: 'Failed to deactivate contractor' });
      return;
    }

    console.log(`[admin] Contractor ${id} deactivated`);
    res.json({ success: true, message: 'Contractor deactivated' });
  } catch (err) {
    console.error('[admin] Deactivate contractor error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/contractors/:id/leads — View contractor's leads (dev mode only)
// ---------------------------------------------------------------------------
router.get('/contractors/:id/leads', async (req: Request, res: Response) => {
  const { id } = req.params;
  const mode = getMode(req);

  if (mode !== 'dev') {
    res.status(403).json({ error: 'Lead access requires dev mode' });
    return;
  }

  try {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('contractor_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[admin] Fetch leads error:', error.message);
      res.status(500).json({ error: 'Failed to fetch leads' });
      return;
    }

    res.json(leads || []);
  } catch (err) {
    console.error('[admin] Fetch leads error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/notifications/test — Send a test push notification
// ---------------------------------------------------------------------------
router.post('/notifications/test', async (req: Request, res: Response) => {
  const { contractorId, title, body } = req.body as {
    contractorId?: string;
    title?: string;
    body?: string;
  };

  if (!contractorId || !title) {
    res.status(400).json({ error: 'Missing contractorId or title' });
    return;
  }

  try {
    await notificationService.sendCustom(
      contractorId,
      title,
      body || 'Test notification from admin dashboard'
    );

    console.log(`[admin] Test notification sent to contractor ${contractorId}`);
    res.json({ success: true, message: 'Notification sent' });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[admin] Test notification error:', errorMsg);
    res.status(500).json({ error: `Failed to send notification: ${errorMsg}` });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/twilio/numbers/search — Search available phone numbers
// ---------------------------------------------------------------------------
router.get('/twilio/numbers/search', async (req: Request, res: Response) => {
  const country = (req.query.country as string) || 'FI';
  const areaCode = req.query.areaCode as string | undefined;
  const contains = req.query.contains as string | undefined;

  try {
    const numbers = await searchAvailableNumbers(country, { areaCode, contains });
    res.json(numbers);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[admin] Number search error:', errorMsg);
    res.status(500).json({ error: errorMsg });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/twilio/numbers/purchase — Purchase and assign a number
// ---------------------------------------------------------------------------
router.post('/twilio/numbers/purchase', async (req: Request, res: Response) => {
  const { contractorId, phoneNumber } = req.body as {
    contractorId?: string;
    phoneNumber?: string;
  };

  if (!contractorId || !phoneNumber) {
    res.status(400).json({ error: 'Missing contractorId or phoneNumber' });
    return;
  }

  try {
    const result = await purchaseAndAssignNumber(contractorId, phoneNumber);
    console.log(`[admin] Number ${result.phoneNumber} purchased and assigned to ${contractorId}`);
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[admin] Number purchase error:', errorMsg);
    res.status(500).json({ error: errorMsg });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/twilio/numbers/:contractorId — Release a contractor's number
// ---------------------------------------------------------------------------
router.delete('/twilio/numbers/:contractorId', async (req: Request, res: Response) => {
  const { contractorId } = req.params;

  try {
    await releaseNumber(contractorId);
    console.log(`[admin] Number released from contractor ${contractorId}`);
    res.json({ success: true, message: 'Number released' });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[admin] Number release error:', errorMsg);
    res.status(500).json({ error: errorMsg });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/me — Check if the current user is an admin
// ---------------------------------------------------------------------------
router.get('/me', async (req: Request, res: Response) => {
  res.json({ isAdmin: true, userId: req.contractorId });
});

export default router;
