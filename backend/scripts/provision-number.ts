#!/usr/bin/env ts-node
/**
 * Provision a new Twilio +358 number for a contractor.
 *
 * Usage:
 *   npx ts-node scripts/provision-number.ts
 *
 * This script:
 *   1. Searches for an available Finnish (+358) local number via Twilio
 *   2. Purchases it (~$1/mo)
 *   3. Configures voice and SMS webhooks to point at your backend
 *   4. Prints the number — you then update the contractor record in Supabase.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   BACKEND_URL (e.g. https://unmissed.fly.dev)
 */

import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.prod' });

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const backendUrl = process.env.BACKEND_URL || process.env.FLY_APP_URL;

if (!accountSid || !authToken) {
  console.error('❌ Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  process.exit(1);
}

if (!backendUrl) {
  console.error('❌ Missing BACKEND_URL (e.g. https://unmissed.fly.dev)');
  process.exit(1);
}

// Dynamic import for Twilio (supports both ESM and CJS)
async function main() {
  const Twilio = (await import('twilio')).default;
  const client = Twilio(accountSid!, authToken!);

  console.log('🔍 Searching for available Finnish (+358) numbers...\n');

  try {
    // Search for available Finnish local numbers
    const available = await client.availablePhoneNumbers('FI')
      .local
      .list({ limit: 5 });

    if (available.length === 0) {
      console.error('❌ No Finnish numbers available. Try a different area or number type.');
      console.log('   Tip: Check if your Twilio account has Finnish numbers enabled.');
      console.log('   You may need to submit a regulatory bundle for Finland.');
      process.exit(1);
    }

    console.log(`Found ${available.length} available numbers:\n`);
    available.forEach((num, i) => {
      console.log(`  ${i + 1}. ${num.phoneNumber} (${num.locality || 'Finland'})`);
    });

    // Purchase the first available number
    const selectedNumber = available[0].phoneNumber;
    console.log(`\n📞 Purchasing ${selectedNumber}...`);

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: selectedNumber,
      // Voice webhook — incoming calls
      voiceUrl: `${backendUrl}/webhooks/twilio-voice`,
      voiceMethod: 'POST',
      // Voice status callback — call completion (triggers SMS flow)
      statusCallback: `${backendUrl}/webhooks/twilio-voice/call-status`,
      statusCallbackMethod: 'POST',
      // SMS webhook — inbound SMS
      smsUrl: `${backendUrl}/webhooks/twilio-sms`,
      smsMethod: 'POST',
      friendlyName: 'Unmissed - Contractor Number',
    });

    console.log('\n✅ Number provisioned successfully!\n');
    console.log('━'.repeat(50));
    console.log(`  Phone Number:  ${purchased.phoneNumber}`);
    console.log(`  SID:           ${purchased.sid}`);
    console.log(`  Voice URL:     ${backendUrl}/webhooks/twilio-voice`);
    console.log(`  SMS URL:       ${backendUrl}/webhooks/twilio-sms`);
    console.log(`  Status CB:     ${backendUrl}/webhooks/twilio-voice/call-status`);
    console.log('━'.repeat(50));
    console.log('\n📋 Next steps:');
    console.log(`  1. Copy the number: ${purchased.phoneNumber}`);
    console.log('  2. Update the contractor record in Supabase:');
    console.log(`     UPDATE contractors SET twilio_phone_number = '${purchased.phoneNumber}' WHERE id = '<contractor-id>';`);
    console.log('  3. Tell the contractor to set up call forwarding to this number');
    console.log('\n📱 Call forwarding instructions for the contractor:');
    console.log('  Elisa:  **21*' + purchased.phoneNumber.replace('+', '') + '#');
    console.log('  Telia:  **21*' + purchased.phoneNumber.replace('+', '') + '#');
    console.log('  DNA:    **21*' + purchased.phoneNumber.replace('+', '') + '#');
    console.log('  (These are unconditional forwarding codes. For no-answer only, use **61* instead of **21*)');

  } catch (err: any) {
    console.error('❌ Failed to provision number:', err.message);

    if (err.message?.includes('regulatory')) {
      console.log('\n📋 Finland requires a regulatory bundle for phone numbers.');
      console.log('   Go to: https://console.twilio.com/us1/develop/phone-numbers/regulatory-compliance');
      console.log('   Submit a "Business" bundle for Finland with your company details.');
    }

    process.exit(1);
  }
}

main();
