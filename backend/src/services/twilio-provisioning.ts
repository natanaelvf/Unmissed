import Twilio from 'twilio';
import { env } from '../config/env';
import { supabase } from '../config/supabase';

// ---------------------------------------------------------------------------
// Twilio Provisioning Service
//
// Uses the MAIN Account SID + Auth Token (not the restricted API key) because
// the IncomingPhoneNumbers resource requires full account credentials.
// This is a separate client from the restricted one used for SMS/Voice.
// ---------------------------------------------------------------------------

/**
 * Create a full-privilege Twilio client for provisioning operations.
 * This is intentionally NOT the restricted API key client.
 */
function createProvisioningClient(): ReturnType<typeof Twilio> {
  return Twilio(env.twilioAccountSid, env.twilioAuthToken);
}

const provisioningClient = createProvisioningClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  isoCountry: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

export interface PurchasedNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  voiceUrl: string;
  smsUrl: string;
}

// ---------------------------------------------------------------------------
// Search available numbers
// ---------------------------------------------------------------------------

/**
 * Search for available local phone numbers in a given country.
 *
 * @param country - ISO 3166-1 alpha-2 country code (e.g. 'FI', 'US', 'GB')
 * @param options - Optional filters (areaCode, contains pattern)
 * @returns Up to 10 available numbers
 */
export async function searchAvailableNumbers(
  country: string,
  options?: { areaCode?: string; contains?: string }
): Promise<AvailableNumber[]> {
  const searchParams: Record<string, unknown> = {
    limit: 10,
    voiceEnabled: true,
    smsEnabled: true,
  };

  if (options?.areaCode) {
    searchParams.areaCode = options.areaCode;
  }
  if (options?.contains) {
    searchParams.contains = options.contains;
  }

  try {
    const numbers = await provisioningClient
      .availablePhoneNumbers(country.toUpperCase())
      .local.list(searchParams);

    return numbers.map((n) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality || '',
      region: n.region || '',
      isoCountry: n.isoCountry,
      capabilities: {
        voice: n.capabilities?.voice ?? false,
        sms: n.capabilities?.sms ?? false,
        mms: n.capabilities?.mms ?? false,
      },
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[provisioning] Search failed for country ${country}:`, message);
    throw new Error(`Failed to search numbers: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Purchase and assign a number
// ---------------------------------------------------------------------------

/**
 * Purchase a Twilio phone number and assign it to a contractor.
 *
 * 1. Buys the number via Twilio API
 * 2. Configures voice/SMS webhook URLs pointing to our backend
 * 3. Updates the contractor's `twilio_phone_number` in the database
 *
 * @param contractorId - The contractor UUID to assign the number to
 * @param phoneNumber - The E.164 phone number to purchase (from search results)
 * @returns The purchased number details
 */
export async function purchaseAndAssignNumber(
  contractorId: string,
  phoneNumber: string
): Promise<PurchasedNumber> {
  // Verify the contractor exists and doesn't already have a number
  const { data: contractor, error: lookupError } = await supabase
    .from('contractors')
    .select('id, twilio_phone_number, business_name')
    .eq('id', contractorId)
    .single();

  if (lookupError || !contractor) {
    throw new Error('Contractor not found');
  }

  if (contractor.twilio_phone_number) {
    throw new Error(
      `Contractor already has number ${contractor.twilio_phone_number}. ` +
      `Release it first before assigning a new one.`
    );
  }

  // Determine webhook base URL
  const baseUrl = env.appBaseUrl;
  if (!baseUrl) {
    throw new Error(
      'APP_BASE_URL is not configured. Set this env var to your deployed URL ' +
      '(e.g. https://your-app-name.fly.dev) before purchasing numbers.'
    );
  }

  const voiceUrl = `${baseUrl}/webhooks/twilio-voice`;
  const smsUrl = `${baseUrl}/webhooks/twilio-sms`;
  const statusCallbackUrl = `${baseUrl}/webhooks/twilio-voice/call-status`;

  try {
    // Purchase the number
    const purchased = await provisioningClient.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl,
      voiceMethod: 'POST',
      smsUrl,
      smsMethod: 'POST',
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: 'POST',
      friendlyName: `Unmissed — ${contractor.business_name || contractorId}`,
    });

    console.log(
      `[provisioning] Purchased ${purchased.phoneNumber} (SID: ${purchased.sid}) ` +
      `for contractor ${contractorId}`
    );

    // Update the contractor record
    const { error: updateError } = await supabase
      .from('contractors')
      .update({
        twilio_phone_number: purchased.phoneNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractorId);

    if (updateError) {
      console.error(
        `[provisioning] WARNING: Number purchased but DB update failed! ` +
        `Number: ${purchased.phoneNumber}, SID: ${purchased.sid}, ` +
        `Error: ${updateError.message}`
      );
      // Don't throw — the number is purchased, we just need to fix the DB manually
    }

    return {
      sid: purchased.sid,
      phoneNumber: purchased.phoneNumber,
      friendlyName: purchased.friendlyName,
      voiceUrl: purchased.voiceUrl || voiceUrl,
      smsUrl: purchased.smsUrl || smsUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[provisioning] Purchase failed for ${phoneNumber}:`, message);
    throw new Error(`Failed to purchase number: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Release a number
// ---------------------------------------------------------------------------

/**
 * Release a Twilio phone number from a contractor.
 *
 * 1. Finds the number's SID via Twilio API
 * 2. Releases (deletes) the number from the account
 * 3. Clears the contractor's `twilio_phone_number` in the database
 *
 * @param contractorId - The contractor UUID whose number to release
 */
export async function releaseNumber(contractorId: string): Promise<void> {
  // Look up the contractor's current number
  const { data: contractor, error: lookupError } = await supabase
    .from('contractors')
    .select('id, twilio_phone_number')
    .eq('id', contractorId)
    .single();

  if (lookupError || !contractor) {
    throw new Error('Contractor not found');
  }

  if (!contractor.twilio_phone_number) {
    throw new Error('Contractor has no Twilio number assigned');
  }

  const phoneNumber = contractor.twilio_phone_number;

  try {
    // Find the incoming phone number SID
    const numbers = await provisioningClient.incomingPhoneNumbers.list({
      phoneNumber,
      limit: 1,
    });

    if (numbers.length === 0) {
      console.warn(
        `[provisioning] Number ${phoneNumber} not found in Twilio account. ` +
        `Clearing DB record anyway.`
      );
    } else {
      // Release the number
      await provisioningClient.incomingPhoneNumbers(numbers[0].sid).remove();
      console.log(
        `[provisioning] Released ${phoneNumber} (SID: ${numbers[0].sid}) ` +
        `from contractor ${contractorId}`
      );
    }

    // Clear the contractor's number in the database
    const { error: updateError } = await supabase
      .from('contractors')
      .update({
        twilio_phone_number: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractorId);

    if (updateError) {
      console.error(
        `[provisioning] WARNING: Number released but DB update failed! ` +
        `Error: ${updateError.message}`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[provisioning] Release failed for ${phoneNumber}:`, message);
    throw new Error(`Failed to release number: ${message}`);
  }
}
