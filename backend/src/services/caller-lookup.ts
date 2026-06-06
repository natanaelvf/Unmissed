import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { twilioClient as client } from '../config/twilio-client';

/**
 * Look up a caller's name using Twilio Lookup V2 API.
 *
 * This is opt-in per contractor (caller_lookup_enabled flag).
 * Costs ~$0.01 per lookup. The count is tracked on the contractor
 * for billing purposes.
 *
 * Returns the caller name if found, null otherwise.
 * Never throws — gracefully degrades on any error.
 */
export async function lookupCallerName(
  phone: string,
  contractorId: string
): Promise<string | null> {
  try {
    // Check if the contractor has caller lookup enabled
    const { data: contractor, error: cErr } = await supabase
      .from('contractors')
      .select('caller_lookup_enabled, caller_lookup_count')
      .eq('id', contractorId)
      .single();

    if (cErr || !contractor) {
      console.warn(`[caller-lookup] Contractor ${contractorId} not found, skipping lookup`);
      return null;
    }

    // Default: opted-in. Allow opt-out.
    if (contractor.caller_lookup_enabled === false) {
      return null;
    }

    // Perform the lookup
    const result = await client.lookups.v2
      .phoneNumbers(phone)
      .fetch({ fields: 'caller_name' });

    // Increment the lookup counter for billing tracking
    await supabase
      .from('contractors')
      .update({
        caller_lookup_count: (contractor.caller_lookup_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractorId);

    // Extract caller name from the response
    const callerNameInfo = result.callerName;
    if (callerNameInfo && callerNameInfo.callerName) {
      const name = callerNameInfo.callerName.trim();
      if (name && name.length > 0 && name !== 'UNKNOWN' && name !== 'UNAVAILABLE') {
        console.log(`[caller-lookup] Found name for ${phone}: ${name}`);
        return name;
      }
    }

    console.log(`[caller-lookup] No name found for ${phone}`);
    return null;
  } catch (err) {
    // Gracefully degrade — caller lookup is a nice-to-have
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[caller-lookup] Lookup failed for ${phone}: ${msg}`);
    return null;
  }
}

/**
 * Attempt to set the caller name on a lead, if not already set.
 * Called after a missed call is detected.
 *
 * Non-blocking: errors are logged but never propagated.
 */
export async function enrichLeadWithCallerName(
  leadId: string,
  phone: string,
  contractorId: string
): Promise<void> {
  try {
    const name = await lookupCallerName(phone, contractorId);
    if (name) {
      await supabase
        .from('leads')
        .update({
          caller_name: name,
          caller_name_source: 'cnam_lookup',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .is('caller_name', null); // Only set if not already set
    }
  } catch (err) {
    console.warn(`[caller-lookup] enrichLeadWithCallerName failed for lead ${leadId}:`, err);
  }
}
