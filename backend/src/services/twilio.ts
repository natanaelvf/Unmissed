import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { twilioClient } from '../config/twilio-client';
import { Contractor } from '../types';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

/**
 * Check if a Twilio error is transient and worth retrying.
 */
function isTransientError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status;
    return status === 429 || status >= 500;
  }
  return false;
}

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send an SMS via Twilio with atomic cap enforcement and retry logic.
 *
 * Uses the `increment_sms_usage` Postgres RPC to atomically check the cap
 * and increment the counter in a single operation, preventing race conditions.
 *
 * Throws 'SMS_CAP_REACHED' if the contractor has exceeded their monthly limit.
 */
export async function sendSms(
  to: string,
  from: string,
  body: string
): Promise<string> {
  // Look up contractor by Twilio number to get their ID
  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('twilio_phone_number', from)
    .single();

  if (contractor) {
    // Atomically check cap and increment — returns -1 if cap reached
    const { data: newCount, error: rpcError } = await supabase
      .rpc('increment_sms_usage', { p_contractor_id: contractor.id });

    if (rpcError) {
      console.error(`[twilio] SMS cap check failed: ${rpcError.message}`);
      // Proceed anyway rather than blocking SMS on a DB error
    } else if (newCount === -1) {
      console.warn(`[twilio] SMS cap reached for contractor ${contractor.id}`);
      throw new Error('SMS_CAP_REACHED');
    }
  }

  // Send with retry on transient errors
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await twilioClient.messages.create({ to, from, body });
      return message.sid;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES && isTransientError(err)) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[twilio] Transient error on attempt ${attempt + 1}, retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Look up the contractor who owns a given Twilio phone number.
 */
export async function lookupContractorByTwilioNumber(
  phoneNumber: string
): Promise<Contractor | null> {
  console.log(`[twilio] Looking up contractor for Twilio number: "${phoneNumber}"`);

  // Use .limit() instead of .single() to avoid crashing when duplicate rows exist.
  // .single() throws "Cannot coerce the result to a single JSON object" on duplicates.
  const { data, error } = await supabase
    .from('contractors')
    .select('*')
    .eq('twilio_phone_number', phoneNumber)
    .order('created_at', { ascending: true })
    .limit(2);

  if (error || !data || data.length === 0) {
    console.warn(`[twilio] Contractor lookup failed for "${phoneNumber}":`, error?.message || 'no data');
    return null;
  }

  if (data.length > 1) {
    console.error(
      `[twilio] ⚠️  DUPLICATE CONTRACTORS detected for Twilio number "${phoneNumber}"! ` +
      `Found ${data.length}+ rows. IDs: ${data.map((c) => c.id).join(', ')}. ` +
      `Using the oldest entry. Please remove duplicates from the contractors table.`
    );
  }

  console.log(`[twilio] Found contractor: ${data[0].business_name} (${data[0].id})`);
  return data[0] as Contractor;
}
