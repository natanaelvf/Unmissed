/**
 * E2E Smoke Test — Simulates the full Unmissed flow without a phone.
 *
 * Sends signed HTTP requests to the production backend, exactly like
 * Twilio and Calendly would. Tests:
 *
 *   1. Incoming call → IVR response
 *   2. Call status (no-answer) → lead created, consent SMS triggered
 *   3. SMS reply "kyllä" (consent) → qualification starts
 *   4. SMS reply "vesivuoto" (issue) → urgency question
 *   5. SMS reply "korkea" (urgency) → name question
 *   6. SMS reply "Matti" (name) → booking link sent
 *   7. Calendly webhook (invitee.created) → lead status → booked
 *
 * Usage:
 *   npx tsx scripts/e2e-smoke-test.ts [--prod]
 *
 * Defaults to local (http://localhost:3000). Use --prod for Fly.io.
 */

import crypto from 'crypto';

// ─── Configuration ───────────────────────────────────────────────
const USE_PROD = process.argv.includes('--prod');
const BASE_URL = USE_PROD
  ? 'https://unmissed-kzw83g.fly.dev'
  : 'http://localhost:3000';

// These must match what's set on the server
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const CALENDLY_WEBHOOK_SECRET = process.env.CALENDLY_WEBHOOK_SECRET || '';

const CALLER_PHONE = '+358401234567'; // Simulated caller
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+358457923822';
const CALL_SID = `CA${crypto.randomBytes(16).toString('hex')}`;

// ─── Helpers ─────────────────────────────────────────────────────

function generateTwilioSignature(url: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  return crypto
    .createHmac('sha1', TWILIO_AUTH_TOKEN)
    .update(data)
    .digest('base64');
}

function generateCalendlySignature(body: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = `${timestamp}.${body}`;
  const signature = crypto
    .createHmac('sha256', CALENDLY_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

async function postTwilio(
  path: string,
  params: Record<string, string>,
  label: string
): Promise<{ status: number; body: string }> {
  const url = `${BASE_URL}${path}`;
  const signature = generateTwilioSignature(url, params);

  const body = new URLSearchParams(params).toString();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📞 ${label}`);
  console.log(`   POST ${path}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Twilio-Signature': signature,
    },
    body,
  });

  const text = await res.text();
  const statusIcon = res.ok ? '✅' : '❌';
  console.log(`   ${statusIcon} ${res.status} ${res.statusText}`);

  // Parse TwiML if it's XML
  if (text.includes('<Response>')) {
    const sayMatch = text.match(/<Say[^>]*>(.*?)<\/Say>/gs);
    const smsMatch = text.match(/<Message[^>]*>(.*?)<\/Message>/gs);
    if (sayMatch) {
      console.log(`   🔊 TwiML Says: "${sayMatch.map(s => s.replace(/<[^>]+>/g, '')).join(' | ')}"`);
    }
    if (smsMatch) {
      console.log(`   💬 TwiML SMS: "${smsMatch.map(s => s.replace(/<[^>]+>/g, '')).join(' | ')}"`);
    }
  } else if (text.length < 500) {
    console.log(`   📄 ${text}`);
  }

  return { status: res.status, body: text };
}

async function postCalendly(label: string): Promise<{ status: number; body: string }> {
  const url = `${BASE_URL}/webhooks/calendly`;

  const payload = {
    event: 'invitee.created',
    created_at: new Date().toISOString(),
    created_by: 'https://api.calendly.com/users/9a1041fd-66dc-425e-a566-60bc19a34935',
    payload: {
      cancel_url: 'https://calendly.com/cancellations/test123',
      created_at: new Date().toISOString(),
      email: 'matti@example.com',
      event: 'https://api.calendly.com/scheduled_events/test-event-123',
      first_name: 'Matti',
      last_name: 'Testaaja',
      name: 'Matti Testaaja',
      questions_and_answers: [
        {
          answer: CALLER_PHONE,
          position: 0,
          question: 'Phone Number',
        },
      ],
      status: 'active',
      text_reminder_number: CALLER_PHONE,
      timezone: 'Europe/Helsinki',
      tracking: {
        utm_source: 'unmissed',
        utm_medium: 'sms',
        utm_campaign: 'missed_call_recovery',
      },
      uri: `https://api.calendly.com/scheduled_events/test-event-123/invitees/test-invitee-123`,
    },
  };

  const bodyStr = JSON.stringify(payload);
  const signature = generateCalendlySignature(bodyStr);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📅 ${label}`);
  console.log(`   POST /webhooks/calendly`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Calendly-Webhook-Signature': signature,
    },
    body: bodyStr,
  });

  const text = await res.text();
  const statusIcon = res.ok ? '✅' : '❌';
  console.log(`   ${statusIcon} ${res.status} ${res.statusText}`);
  if (text.length < 500) {
    console.log(`   📄 ${text}`);
  }

  return { status: res.status, body: text };
}

async function checkLeadStatus(label: string): Promise<void> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🔍 ${label}`);

  const res = await fetch(`${BASE_URL}/api/leads?limit=1`);
  if (!res.ok) {
    console.log(`   ❌ Failed to fetch leads: ${res.status}`);
    return;
  }
  const data = await res.json() as any;
  if (data.data?.length > 0) {
    const lead = data.data[0];
    console.log(`   Lead ID:     ${lead.id}`);
    console.log(`   Status:      ${lead.status}`);
    console.log(`   Phone:       ${lead.caller_phone}`);
    console.log(`   Name:        ${lead.caller_name || '(none)'}`);
    console.log(`   Urgency:     ${lead.urgency || '(none)'}`);
    console.log(`   Issue:       ${lead.issue_description || '(none)'}`);
    console.log(`   SMS State:   ${lead.sms_conversation_state || '(none)'}`);
    console.log(`   Booked At:   ${lead.booked_at || '(none)'}`);
  } else {
    console.log(`   (no leads found)`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Main Flow ───────────────────────────────────────────────────

async function main() {
  console.log(`\n${'╔'.padEnd(59, '═')}╗`);
  console.log(`║ Unmissed E2E Smoke Test${' '.repeat(35)}║`);
  console.log(`║ Target: ${BASE_URL.padEnd(49)}║`);
  console.log(`║ Caller: ${CALLER_PHONE.padEnd(49)}║`);
  console.log(`║ Twilio: ${TWILIO_NUMBER.padEnd(49)}║`);
  console.log(`${'╚'.padEnd(59, '═')}╝`);

  if (!TWILIO_AUTH_TOKEN) {
    console.error('\n❌ TWILIO_AUTH_TOKEN env var required for signing requests.');
    console.error('   Run: $env:TWILIO_AUTH_TOKEN="your-token"; npx tsx scripts/e2e-smoke-test.ts');
    process.exit(1);
  }

  // ─── Step 1: Incoming Call ───
  const incomingResult = await postTwilio(
    '/webhooks/twilio-voice',
    {
      CallSid: CALL_SID,
      AccountSid: 'ACtest',
      From: CALLER_PHONE,
      To: TWILIO_NUMBER,
      CallStatus: 'ringing',
      Direction: 'inbound',
      CallerCountry: 'FI',
    },
    'Step 1: Incoming Call (→ IVR/voicemail)'
  );

  await sleep(1000);

  // ─── Step 2: Call Completed (no-answer → missed call) ───
  await postTwilio(
    '/webhooks/twilio-voice/call-status',
    {
      CallSid: CALL_SID,
      AccountSid: 'ACtest',
      From: CALLER_PHONE,
      To: TWILIO_NUMBER,
      CallStatus: 'no-answer',
      Direction: 'inbound',
      CallDuration: '0',
    },
    'Step 2: Call Status → no-answer (triggers consent SMS)'
  );

  await sleep(2000);

  // ─── Step 3: Caller replies "kyllä" (consent) ───
  await postTwilio(
    '/webhooks/twilio-sms',
    {
      MessageSid: `SM${crypto.randomBytes(16).toString('hex')}`,
      AccountSid: 'ACtest',
      From: CALLER_PHONE,
      To: TWILIO_NUMBER,
      Body: 'kyllä',
    },
    'Step 3: SMS Reply "kyllä" (consent → asks for issue)'
  );

  await sleep(2000);

  // ─── Step 4: Caller describes issue ───
  await postTwilio(
    '/webhooks/twilio-sms',
    {
      MessageSid: `SM${crypto.randomBytes(16).toString('hex')}`,
      AccountSid: 'ACtest',
      From: CALLER_PHONE,
      To: TWILIO_NUMBER,
      Body: 'vesivuoto keittiössä',
    },
    'Step 4: SMS Reply "vesivuoto keittiössä" (issue → asks urgency)'
  );

  await sleep(2000);

  // ─── Step 5: Caller indicates urgency ───
  await postTwilio(
    '/webhooks/twilio-sms',
    {
      MessageSid: `SM${crypto.randomBytes(16).toString('hex')}`,
      AccountSid: 'ACtest',
      From: CALLER_PHONE,
      To: TWILIO_NUMBER,
      Body: 'korkea',
    },
    'Step 5: SMS Reply "korkea" (urgency → asks name)'
  );

  await sleep(2000);

  // ─── Step 6: Caller provides name ───
  await postTwilio(
    '/webhooks/twilio-sms',
    {
      MessageSid: `SM${crypto.randomBytes(16).toString('hex')}`,
      AccountSid: 'ACtest',
      From: CALLER_PHONE,
      To: TWILIO_NUMBER,
      Body: 'Matti Testaaja',
    },
    'Step 6: SMS Reply "Matti Testaaja" (name → sends booking link)'
  );

  await sleep(2000);

  // ─── Step 7: Calendly booking webhook ───
  if (CALENDLY_WEBHOOK_SECRET) {
    await postCalendly('Step 7: Calendly Webhook → invitee.created (booking confirmed)');
  } else {
    console.log(`\n${'═'.repeat(60)}`);
    console.log('⏭️  Skipping Calendly webhook (CALENDLY_WEBHOOK_SECRET not set)');
  }

  // ─── Summary ───
  console.log(`\n${'╔'.padEnd(59, '═')}╗`);
  console.log(`║ Smoke Test Complete${' '.repeat(39)}║`);
  console.log(`${'╚'.padEnd(59, '═')}╝\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
