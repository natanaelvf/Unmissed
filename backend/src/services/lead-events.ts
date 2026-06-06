import { supabase } from '../config/supabase';

/**
 * Event types that can be recorded for a lead.
 */
export type LeadEventType =
  | 'call_received'       // Incoming call hit the IVR
  | 'call_missed'         // Call completed with no-answer
  | 'consent_sms_sent'    // Consent request SMS sent
  | 'consent_given'       // Caller replied YES
  | 'consent_declined'    // Caller replied NO
  | 'sms_sent'            // Any outbound SMS
  | 'sms_received'        // Any inbound SMS
  | 'issue_provided'      // Caller described their issue
  | 'urgency_set'         // Urgency level determined
  | 'name_identified'     // Caller's name obtained
  | 'booking_link_sent'   // Booking link SMS sent
  | 'booking_created'     // Calendly booking confirmed
  | 'booking_cancelled'   // Calendly booking cancelled
  | 'status_changed'      // Lead status transition
  | 'emergency_call'      // Emergency call placed to contractor
  | 'dnr_alert'           // Did-not-respond alert fired
  | 'completed'           // Job marked as completed
  | 'satisfaction_sent'   // Satisfaction survey sent
  | 'satisfaction_received' // Satisfaction score received
  | 'note_added';         // Contractor added a note

/**
 * Record a timeline event for a lead.
 *
 * This is a fire-and-forget operation — failures are logged but don't
 * crash the calling function. The timeline is a nice-to-have, not
 * mission-critical.
 */
export async function recordLeadEvent(
  leadId: string,
  eventType: LeadEventType,
  eventData: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { error } = await supabase.from('lead_events').insert({
      lead_id: leadId,
      event_type: eventType,
      event_data: eventData,
    });

    if (error) {
      console.warn(`[lead-events] Failed to record ${eventType} for lead ${leadId}: ${error.message}`);
    }
  } catch (err) {
    // Truly fire-and-forget — never crash the caller
    console.warn(`[lead-events] Error recording ${eventType}:`, err);
  }
}

/**
 * Fetch the full timeline for a lead, ordered chronologically.
 */
export async function getLeadTimeline(leadId: string) {
  const { data, error } = await supabase
    .from('lead_events')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(`[lead-events] Failed to fetch timeline for lead ${leadId}: ${error.message}`);
    return [];
  }

  return data || [];
}
