import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/calendar/status — Current contractor's Google Calendar status
// ---------------------------------------------------------------------------
router.get('/calendar/status', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const { data: contractor, error } = await supabase
      .from('contractors')
      .select('calendar_booking_enabled, google_connected_at, google_token_expiry, booking_slot_duration_min')
      .eq('id', contractorId)
      .single();

    if (error || !contractor) {
      res.status(404).json({ error: 'Contractor not found' });
      return;
    }

    res.json({
      connected: !!contractor.google_connected_at,
      calendarBookingEnabled: contractor.calendar_booking_enabled ?? false,
      slotDurationMin: contractor.booking_slot_duration_min ?? 30,
      connectedAt: contractor.google_connected_at ?? null,
    });
  } catch (err) {
    console.error('[api] Calendar status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/calendar/settings — Update calendar booking settings
// ---------------------------------------------------------------------------
router.patch('/calendar/settings', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  const { calendar_booking_enabled, booking_slot_duration_min } = req.body as {
    calendar_booking_enabled?: boolean;
    booking_slot_duration_min?: number;
  };

  const updates: Record<string, unknown> = {};

  if (typeof calendar_booking_enabled === 'boolean') {
    updates['calendar_booking_enabled'] = calendar_booking_enabled;
  }

  if (typeof booking_slot_duration_min === 'number') {
    const validDurations = [15, 30, 45, 60];
    if (!validDurations.includes(booking_slot_duration_min)) {
      res.status(400).json({ error: 'booking_slot_duration_min must be 15, 30, 45, or 60' });
      return;
    }
    updates['booking_slot_duration_min'] = booking_slot_duration_min;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  updates['updated_at'] = new Date().toISOString();

  try {
    await supabase
      .from('contractors')
      .update(updates)
      .eq('id', contractorId);

    res.json({ ok: true });
  } catch (err) {
    console.error('[api] Calendar settings update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
