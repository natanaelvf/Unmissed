import { google } from 'googleapis';
import { env } from '../config/env';
import { Contractor } from '../types';

// Use the OAuth2Client type from googleapis' bundled auth library to avoid
// duplicate type declaration errors caused by having both `googleapis` and
// `google-auth-library` as direct dependencies.
type GoogleOAuth2Client = InstanceType<typeof google.auth.OAuth2>;

// -----------------------------------------------------------------------
// OAuth2 client factory
// -----------------------------------------------------------------------

export function createOAuth2Client(): GoogleOAuth2Client {
  return new google.auth.OAuth2(
    env.googleWebClientId,
    env.googleClientSecret,
    `${env.appBaseUrl}/auth/google-calendar/callback`
  );
}

/**
 * Build an authenticated OAuth2 client for a contractor.
 * Refreshes the access token automatically if expired.
 */
async function getAuthenticatedClient(contractor: Contractor): Promise<GoogleOAuth2Client> {
  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    access_token: contractor.google_access_token,
    refresh_token: contractor.google_refresh_token,
    expiry_date: contractor.google_token_expiry
      ? new Date(contractor.google_token_expiry).getTime()
      : undefined,
  });

  return oauth2Client;
}

// -----------------------------------------------------------------------
// Slot generation helpers
// -----------------------------------------------------------------------

interface TimeSlot {
  start: Date;
  end: Date;
}

/**
 * Parse "HH:MM" string into hours and minutes.
 */
function parseHHMM(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { hours: h || 0, minutes: m || 0 };
}

/**
 * Generate candidate slots for a single day based on contractor working hours.
 * Slots are `durationMin` minutes wide, starting from working_hours_start to
 * working_hours_end.
 */
function generateDaySlots(date: Date, contractor: Contractor): TimeSlot[] {
  const durationMin = contractor.booking_slot_duration_min || 30;
  const { hours: startH, minutes: startM } = parseHHMM(contractor.working_hours_start);
  const { hours: endH, minutes: endM } = parseHHMM(contractor.working_hours_end);

  const slots: TimeSlot[] = [];

  // Build slots in the contractor's timezone by using UTC offsets aligned
  // to a date string. We work in plain Date arithmetic here; the booking
  // page will display in the contractor's locale.
  const dayStart = new Date(date);
  dayStart.setHours(startH, startM, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(endH, endM, 0, 0);

  let cursor = new Date(dayStart);
  while (cursor.getTime() + durationMin * 60_000 <= dayEnd.getTime()) {
    const slotEnd = new Date(cursor.getTime() + durationMin * 60_000);
    slots.push({ start: new Date(cursor), end: slotEnd });
    cursor = slotEnd;
  }

  return slots;
}

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

export interface AvailableSlot {
  start: string;  // ISO-8601
  end: string;    // ISO-8601
}

/**
 * Return available booking slots for the next `lookAheadDays` days.
 * Slots are generated from contractor working hours and filtered against
 * the contractor's Google Calendar busy times (free/busy query).
 */
export async function getAvailableSlots(
  contractor: Contractor,
  lookAheadDays = 7
): Promise<AvailableSlot[]> {
  const durationMin = contractor.booking_slot_duration_min || 30;

  // Build candidate slots for the look-ahead window
  const now = new Date();
  const windowEnd = new Date(now.getTime() + lookAheadDays * 24 * 60 * 60_000);

  const candidateSlots: TimeSlot[] = [];
  for (let d = 0; d < lookAheadDays; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);

    // Skip days outside contractor working_days (0=Sun … 6=Sat)
    const dowJs = day.getDay(); // 0=Sun
    // Adjust from JS Sunday=0 to match DB working_days convention
    // working_days stores 1=Mon … 7=Sun by UI convention but stored as [1,2,3,4,5]
    // Convert JS getDay() (Sun=0) to Mon=1..Sun=7
    const dow = dowJs === 0 ? 7 : dowJs;
    if (!contractor.working_days.includes(dow) && !contractor.working_days.includes(dowJs)) {
      // Try both conventions (Mon=1 array or Sun=0 array)
      // Only skip if neither is found
      const hasJs = contractor.working_days.includes(dowJs);
      const hasMon1 = contractor.working_days.includes(dow);
      if (!hasJs && !hasMon1) continue;
    }

    const daySlots = generateDaySlots(day, contractor);
    // Filter out slots that are in the past (with 30-min buffer)
    const bufferMs = durationMin * 60_000;
    for (const slot of daySlots) {
      if (slot.start.getTime() > now.getTime() + bufferMs) {
        candidateSlots.push(slot);
      }
    }
  }

  if (candidateSlots.length === 0) return [];

  // Fetch busy periods from Google Calendar
  let busyPeriods: Array<{ start: string; end: string }> = [];
  if (contractor.google_refresh_token) {
    try {
      const auth = await getAuthenticatedClient(contractor);
      const calendarApi = google.calendar({ version: 'v3', auth });

      const freeBusyRes = await calendarApi.freebusy.query({
        requestBody: {
          timeMin: now.toISOString(),
          timeMax: windowEnd.toISOString(),
          timeZone: contractor.timezone || 'Europe/Helsinki',
          items: [{ id: contractor.google_calendar_id || 'primary' }],
        },
      });

      const calId = contractor.google_calendar_id || 'primary';
      busyPeriods = (freeBusyRes.data.calendars?.[calId]?.busy ?? [])
        .filter((b): b is { start: string; end: string } =>
          typeof b.start === 'string' && typeof b.end === 'string'
        );
    } catch (err) {
      // If we can't fetch free/busy, return all candidate slots rather than
      // blocking the entire booking flow
      console.error('[calendar] Free/busy query failed:', err);
    }
  }

  // Filter out candidate slots that overlap any busy period
  const available = candidateSlots.filter((slot) => {
    return !busyPeriods.some((busy) => {
      const busyStart = new Date(busy.start!).getTime();
      const busyEnd = new Date(busy.end!).getTime();
      // Overlap if: slot starts before busy ends AND slot ends after busy starts
      return slot.start.getTime() < busyEnd && slot.end.getTime() > busyStart;
    });
  });

  return available.map((s) => ({
    start: s.start.toISOString(),
    end: s.end.toISOString(),
  }));
}

/**
 * Create a calendar event on the contractor's primary calendar.
 * Returns the event ID and an htmlLink to the Google Calendar event.
 */
export async function createCalendarEvent(
  contractor: Contractor,
  slotStart: string,
  slotEnd: string,
  callerName: string,
  callerPhone: string,
  callerEmail: string | null,
  issueDescription: string | null
): Promise<{ eventId: string; htmlLink: string }> {
  const auth = await getAuthenticatedClient(contractor);
  const calendarApi = google.calendar({ version: 'v3', auth });

  const summary = `Booking: ${callerName} — ${issueDescription || 'Service request'}`;
  const description = [
    `Caller: ${callerName}`,
    `Phone: ${callerPhone}`,
    callerEmail ? `Email: ${callerEmail}` : null,
    issueDescription ? `Issue: ${issueDescription}` : null,
    '',
    'Booked via Unmissed — https://unmissed.io',
  ]
    .filter(Boolean)
    .join('\n');

  const attendees = callerEmail ? [{ email: callerEmail }] : [];

  const res = await calendarApi.events.insert({
    calendarId: contractor.google_calendar_id || 'primary',
    sendUpdates: callerEmail ? 'all' : 'none',
    requestBody: {
      summary,
      description,
      start: { dateTime: slotStart, timeZone: contractor.timezone || 'Europe/Helsinki' },
      end: { dateTime: slotEnd, timeZone: contractor.timezone || 'Europe/Helsinki' },
      attendees,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    },
  });

  const event = res.data;
  if (!event.id) throw new Error('Google Calendar event creation failed — no event ID returned');

  return {
    eventId: event.id,
    htmlLink: event.htmlLink ?? `https://calendar.google.com`,
  };
}

/**
 * Cancel a calendar event. Safe to call even if the event no longer exists.
 */
export async function cancelCalendarEvent(
  contractor: Contractor,
  eventId: string
): Promise<void> {
  try {
    const auth = await getAuthenticatedClient(contractor);
    const calendarApi = google.calendar({ version: 'v3', auth });

    await calendarApi.events.delete({
      calendarId: contractor.google_calendar_id || 'primary',
      eventId,
      sendUpdates: 'all',
    });
  } catch (err) {
    console.error(`[calendar] Failed to cancel event ${eventId}:`, err);
    // Don't rethrow — cancellation failure should not break lead flow
  }
}
