import { Resend } from 'resend';
import { env } from '../config/env';

// Lazy-initialize client so startup doesn't fail if RESEND_API_KEY is missing
let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!env.resendApiKey) return null;
  if (!resendClient) resendClient = new Resend(env.resendApiKey);
  return resendClient;
}

/**
 * Format a Date/ISO string for human-readable display.
 */
function formatDateTime(isoString: string, timezone: string): string {
  return new Date(isoString).toLocaleString('fi-FI', {
    timeZone: timezone,
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

// ---------------------------------------------------------------------------
// Send booking confirmation to contractor
// ---------------------------------------------------------------------------
export async function sendBookingConfirmationToContractor(params: {
  contractorEmail: string;
  businessName: string;
  callerName: string;
  callerPhone: string;
  callerEmail: string | null;
  slotStart: string;
  timezone: string;
  issueDescription: string | null;
  calendarLink: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] Resend not configured — skipping contractor confirmation email');
    return;
  }

  const {
    contractorEmail, businessName, callerName, callerPhone,
    callerEmail, slotStart, timezone, issueDescription, calendarLink,
  } = params;

  const formattedTime = formatDateTime(slotStart, timezone);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #e5e5e5; margin: 0; padding: 0; }
  .container { max-width: 560px; margin: 40px auto; padding: 32px; background: #1a1a1a; border-radius: 12px; border: 1px solid #2a2a2a; }
  .logo { font-size: 18px; font-weight: 700; color: #14b8a6; letter-spacing: -0.5px; margin-bottom: 24px; }
  h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; color: #ffffff; }
  .subtitle { color: #888; font-size: 14px; margin-bottom: 24px; }
  .card { background: #242424; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 3px solid #14b8a6; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #666; margin-bottom: 4px; }
  .value { font-size: 15px; color: #e5e5e5; margin-bottom: 14px; }
  .value:last-child { margin-bottom: 0; }
  .btn { display: inline-block; background: #14b8a6; color: #0f0f0f; font-weight: 700; font-size: 14px;
         padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
  .footer { font-size: 12px; color: #555; margin-top: 24px; }
</style></head>
<body>
<div class="container">
  <div class="logo">Unmissed</div>
  <h1>New booking confirmed ✅</h1>
  <p class="subtitle">A caller has booked a time with ${businessName}.</p>
  <div class="card">
    <div class="label">When</div>
    <div class="value">${formattedTime}</div>
    <div class="label">Caller name</div>
    <div class="value">${callerName}</div>
    <div class="label">Phone</div>
    <div class="value">${callerPhone}</div>
    ${callerEmail ? `<div class="label">Email</div><div class="value">${callerEmail}</div>` : ''}
    ${issueDescription ? `<div class="label">Issue</div><div class="value">${issueDescription}</div>` : ''}
  </div>
  <a href="${calendarLink}" class="btn">View in Google Calendar →</a>
  <div class="footer">Powered by Unmissed · <a href="https://unmissed.io" style="color:#14b8a6;">unmissed.io</a></div>
</div>
</body>
</html>
`;

  try {
    await resend.emails.send({
      from: 'Unmissed <bookings@mail.unmissed.io>',
      to: contractorEmail,
      subject: `New booking: ${callerName} — ${formattedTime}`,
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send contractor confirmation:', err);
    // Don't rethrow — email failure should not break booking flow
  }
}

// ---------------------------------------------------------------------------
// Send booking confirmation to caller (only if email was collected)
// ---------------------------------------------------------------------------
export async function sendBookingConfirmationToCaller(params: {
  callerEmail: string;
  callerName: string;
  businessName: string;
  slotStart: string;
  timezone: string;
  issueDescription: string | null;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] Resend not configured — skipping caller confirmation email');
    return;
  }

  const { callerEmail, callerName, businessName, slotStart, timezone, issueDescription } = params;
  const formattedTime = formatDateTime(slotStart, timezone);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #e5e5e5; margin: 0; padding: 0; }
  .container { max-width: 560px; margin: 40px auto; padding: 32px; background: #1a1a1a; border-radius: 12px; border: 1px solid #2a2a2a; }
  .logo { font-size: 18px; font-weight: 700; color: #14b8a6; letter-spacing: -0.5px; margin-bottom: 24px; }
  h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; color: #ffffff; }
  .subtitle { color: #888; font-size: 14px; margin-bottom: 24px; }
  .card { background: #242424; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 3px solid #14b8a6; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #666; margin-bottom: 4px; }
  .value { font-size: 15px; color: #e5e5e5; margin-bottom: 14px; }
  .value:last-child { margin-bottom: 0; }
  .footer { font-size: 12px; color: #555; margin-top: 24px; }
</style></head>
<body>
<div class="container">
  <div class="logo">Unmissed</div>
  <h1>Your appointment is confirmed ✅</h1>
  <p class="subtitle">Hi ${callerName}, here's a summary of your booking with ${businessName}.</p>
  <div class="card">
    <div class="label">When</div>
    <div class="value">${formattedTime}</div>
    <div class="label">Business</div>
    <div class="value">${businessName}</div>
    ${issueDescription ? `<div class="label">Your request</div><div class="value">${issueDescription}</div>` : ''}
  </div>
  <p style="color:#888;font-size:13px;">If you need to reschedule or cancel, please call ${businessName} directly.</p>
  <div class="footer">Powered by Unmissed · <a href="https://unmissed.io" style="color:#14b8a6;">unmissed.io</a></div>
</div>
</body>
</html>
`;

  try {
    await resend.emails.send({
      from: 'Unmissed <bookings@mail.unmissed.io>',
      to: callerEmail,
      subject: `Appointment confirmed with ${businessName} — ${formattedTime}`,
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send caller confirmation:', err);
  }
}
