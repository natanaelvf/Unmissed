import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { twilioClient } from '../config/twilio-client';
import { Lead, Contractor } from '../types';
import { isWithinWorkingHours } from '../utils/working-hours';

/**
 * Trigger an emergency outbound call to the contractor's phone.
 *
 * Called when the SMS qualification identifies a lead as `high` or `emergency` urgency.
 * The contractor's phone rings; when they answer, they hear an alert message
 * and can press 1 to be connected directly to the lead.
 *
 * Guards:
 *  - Skips if `emergency_call_placed` is already true for this lead
 *  - Skips after hours unless `after_hours_ring` is enabled
 *
 * On success, sets `emergency_call_placed = true` on the lead and schedules
 * a 5-minute retry via `scheduled_tasks` in case the contractor doesn't answer.
 */
export async function triggerEmergencyCall(
  lead: Lead,
  contractor: Contractor,
  isRetry: boolean = false
): Promise<void> {
  // Guard: don't place duplicate emergency calls
  if (lead.emergency_call_placed && !isRetry) {
    console.log(`[emergency-call] Emergency call already placed for lead ${lead.id}, skipping`);
    return;
  }

  // Guard: respect after-hours unless contractor opted in
  if (!isWithinWorkingHours(contractor) && !contractor.after_hours_ring) {
    console.log(
      `[emergency-call] Outside working hours and after_hours_ring=false ` +
      `for contractor ${contractor.id}, skipping emergency call`
    );
    return;
  }

  const baseUrl = `https://unmissed-kzw83g.fly.dev`;
  const urgencyLabel = lead.urgency === 'emergency' ? 'emergency' : 'high';

  try {
    const call = await twilioClient.calls.create({
      to: contractor.contact_phone,
      from: contractor.twilio_phone_number,
      url: `${baseUrl}/webhooks/twilio-voice/emergency-alert` +
           `?leadId=${lead.id}&contractorId=${contractor.id}&urgency=${urgencyLabel}`,
      method: 'POST',
      statusCallback: `${baseUrl}/webhooks/twilio-voice/emergency-call-status` +
                       `?leadId=${lead.id}&contractorId=${contractor.id}&isRetry=${isRetry}`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
      timeout: 30,
    });

    console.log(
      `[emergency-call] Placing ${isRetry ? 'RETRY ' : ''}emergency call ` +
      `to contractor ${contractor.id} (${contractor.contact_phone}) ` +
      `for lead ${lead.id} — Call SID: ${call.sid}`
    );

    // Mark that we've placed an emergency call for this lead
    if (!isRetry) {
      await supabase
        .from('leads')
        .update({
          emergency_call_placed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      // Schedule a retry in 5 minutes in case the contractor doesn't answer
      const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await supabase.from('scheduled_tasks').insert({
        lead_id: lead.id,
        task_type: 'emergency_retry',
        execute_at: retryAt,
        executed: false,
      });

      console.log(`[emergency-call] Scheduled retry at ${retryAt} for lead ${lead.id}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[emergency-call] Failed to place emergency call for lead ${lead.id}: ${errorMsg}`
    );
  }
}
