import { supabase } from '../config/supabase';
import { Lead, Contractor } from '../types';
import { triggerEmergencyCall } from '../services/emergency-call';

/**
 * Emergency retry job.
 *
 * Finds scheduled_tasks of type 'emergency_retry' that are due and not yet
 * executed. For each, re-fetches the lead and contractor, then places a
 * second (and final) emergency call attempt.
 *
 * Called by the consent-timeout cron (every 5 minutes), which runs
 * frequently enough to catch the 5-minute retry window.
 */
export async function runEmergencyRetry(): Promise<void> {
  try {
    const now = new Date().toISOString();

    const { data: tasks, error } = await supabase
      .from('scheduled_tasks')
      .select('*, leads!inner(*, contractors!inner(*))')
      .eq('task_type', 'emergency_retry')
      .eq('executed', false)
      .lte('execute_at', now);

    if (error) {
      console.error('[cron] Emergency retry query error:', error.message);
      return;
    }

    if (!tasks || tasks.length === 0) {
      return;
    }

    for (const task of tasks) {
      const lead = task.leads as unknown as Lead;
      const contractor = (task.leads as Record<string, unknown>).contractors as unknown as Contractor;

      // Mark task as executed immediately to prevent duplicate processing
      await supabase
        .from('scheduled_tasks')
        .update({ executed: true })
        .eq('id', task.id);

      // Only retry if the lead hasn't already been completed
      // (e.g., contractor already called back via the first attempt)
      if (lead.status === 'completed') {
        console.log(`[cron] Emergency retry skipped for lead ${lead.id} — already completed`);
        continue;
      }

      console.log(`[cron] Emergency retry: placing second call for lead ${lead.id}`);
      await triggerEmergencyCall(lead, contractor, true);
    }
  } catch (err) {
    console.error('[cron] Emergency retry check failed:', err);
  }
}
