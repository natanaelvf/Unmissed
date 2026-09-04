import { Router, Request, Response } from 'express';
import path from 'path';
import * as Sentry from '@sentry/node';
import { supabase } from '../../config/supabase';
import { verifyBookingToken } from '../../utils/booking-token';
import { getAvailableSlots, createCalendarEvent } from '../../services/calendar';
import {
  sendBookingConfirmationToContractor,
  sendBookingConfirmationToCaller,
} from '../../services/email';
import { sendPushNotification } from '../../services/notifications';
import { sendSms } from '../../services/twilio';
import { getSmsTemplates } from '../../services/sms-state-machine';
import { LeadStatus, Locale, Contractor, Lead } from '../../types';

const router = Router();

// ---------------------------------------------------------------------------
// GET /book/:token — Serve the booking page HTML
// ---------------------------------------------------------------------------
router.get('/:token', (_req: Request, res: Response) => {
  res.sendFile(path.resolve(process.cwd(), 'public', 'booking.html'));
});

// ---------------------------------------------------------------------------
// GET /api/public/slots/:token — Fetch available slots for a lead's token
// ---------------------------------------------------------------------------
router.get('/api/public/slots/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const payload = verifyBookingToken(token);

    // Fetch lead
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', payload.leadId)
      .single();

    if (leadErr || !lead) {
      res.status(404).json({ error: 'Booking link not found or has expired' });
      return;
    }

    // Validate token matches what's stored (extra guard)
    if (lead.booking_token !== token) {
      res.status(401).json({ error: 'Invalid booking token' });
      return;
    }

    // Check token expiry
    if (lead.booking_token_expires_at && new Date(lead.booking_token_expires_at) < new Date()) {
      res.status(410).json({ error: 'This booking link has expired' });
      return;
    }

    // Already booked?
    if (lead.status === LeadStatus.Booked) {
      res.status(409).json({ error: 'This appointment has already been booked' });
      return;
    }

    // Fetch contractor
    const { data: contractor, error: contractorErr } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', payload.contractorId)
      .single();

    if (contractorErr || !contractor) {
      res.status(404).json({ error: 'Contractor not found' });
      return;
    }

    const slots = await getAvailableSlots(contractor as Contractor);

    res.json({
      slots,
      businessName: contractor.business_name,
      callerName: lead.caller_name,
      issue: lead.issue_description,
      slotDurationMin: contractor.booking_slot_duration_min || 30,
    });
  } catch (err: unknown) {
    // JWT errors (expired, invalid)
    if (err instanceof Error && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
      res.status(401).json({ error: 'This booking link has expired or is invalid' });
      return;
    }
    console.error('[public/slots] Error:', err);
    Sentry.captureException(err, { tags: { route: 'public-slots' } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/public/book/:token — Confirm a booking
// ---------------------------------------------------------------------------
router.post('/api/public/book/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { slotStart, slotEnd, callerEmail } = req.body as {
      slotStart: string;
      slotEnd: string;
      callerEmail?: string;
    };

    if (!slotStart || !slotEnd) {
      res.status(400).json({ error: 'slotStart and slotEnd are required' });
      return;
    }

    const payload = verifyBookingToken(token);

    // Re-fetch lead (guard against double-booking)
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', payload.leadId)
      .single();

    if (leadErr || !lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    if (lead.booking_token !== token) {
      res.status(401).json({ error: 'Invalid booking token' });
      return;
    }

    if (lead.status === LeadStatus.Booked) {
      res.status(409).json({ error: 'This slot has already been booked' });
      return;
    }

    // Fetch contractor
    const { data: contractor, error: contractorErr } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', payload.contractorId)
      .single();

    if (contractorErr || !contractor) {
      res.status(404).json({ error: 'Contractor not found' });
      return;
    }

    // Validate slotStart is a valid ISO date
    const slotDate = new Date(slotStart);
    if (isNaN(slotDate.getTime())) {
      res.status(400).json({ error: 'Invalid slot time' });
      return;
    }

    const typedLead = lead as Lead;
    const typedContractor = contractor as Contractor;

    // Create Google Calendar event
    const { eventId, htmlLink } = await createCalendarEvent(
      typedContractor,
      slotStart,
      slotEnd,
      typedLead.caller_name || 'Unknown',
      typedLead.caller_phone,
      callerEmail || null,
      typedLead.issue_description
    );

    // Format booking time for SMS
    const formattedTime = new Date(slotStart).toLocaleString('fi-FI', {
      timeZone: typedContractor.timezone || 'Europe/Helsinki',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // Update lead: status → booked, store event info + email
    await supabase
      .from('leads')
      .update({
        status: LeadStatus.Booked,
        booking_time: slotStart,
        calendar_event_id: eventId,
        calendar_event_link: htmlLink,
        caller_email: callerEmail || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', typedLead.id);

    // Send booking confirmation SMS to caller
    const T = getSmsTemplates((typedContractor.locale as Locale) ?? 'fi');
    const confirmSms = T.bookingConfirmation(typedContractor.business_name, formattedTime);
    try {
      const smsSid = await sendSms(
        typedLead.caller_phone,
        typedContractor.twilio_phone_number,
        confirmSms
      );
      await supabase.from('messages').insert({
        lead_id: typedLead.id,
        direction: 'outbound',
        body: confirmSms,
        twilio_message_sid: smsSid,
        sent_at: new Date().toISOString(),
      });
    } catch (smsErr) {
      console.error('[public/book] Failed to send confirmation SMS:', smsErr);
      // Non-fatal — booking is still confirmed
    }

    // Send emails (non-blocking, non-fatal)
    Promise.all([
      sendBookingConfirmationToContractor({
        contractorEmail: typedContractor.contact_email,
        businessName: typedContractor.business_name,
        callerName: typedLead.caller_name || 'Unknown',
        callerPhone: typedLead.caller_phone,
        callerEmail: callerEmail || null,
        slotStart,
        timezone: typedContractor.timezone || 'Europe/Helsinki',
        issueDescription: typedLead.issue_description,
        calendarLink: htmlLink,
      }),
      callerEmail
        ? sendBookingConfirmationToCaller({
            callerEmail,
            callerName: typedLead.caller_name || 'there',
            businessName: typedContractor.business_name,
            slotStart,
            timezone: typedContractor.timezone || 'Europe/Helsinki',
            issueDescription: typedLead.issue_description,
          })
        : Promise.resolve(),
    ]).catch((e) => console.error('[public/book] Email error (non-fatal):', e));

    // Push notification to contractor
    sendPushNotification(
      typedContractor.id,
      '📅 New Booking Confirmed!',
      `${typedLead.caller_name || typedLead.caller_phone} booked for ${formattedTime}`,
      { leadId: typedLead.id }
    ).catch((e) => console.error('[public/book] Push notification error:', e));

    res.json({
      confirmed: true,
      slotTime: formattedTime,
      businessName: typedContractor.business_name,
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
      res.status(401).json({ error: 'This booking link has expired or is invalid' });
      return;
    }
    console.error('[public/book] Error:', err);
    Sentry.captureException(err, { tags: { route: 'public-book' } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
