import { supabase } from '../config/supabase';

/**
 * Startup integrity check: detects data issues that would cause silent failures.
 * Runs once when the server starts.
 */
export async function runIntegrityCheck(): Promise<void> {
  console.log('[integrity] Running startup integrity checks...');

  const issues: string[] = [];

  // 1. Check for duplicate Twilio phone numbers across contractors
  await checkDuplicateTwilioNumbers(issues);

  // 2. Check for contractors with missing Twilio numbers
  await checkMissingTwilioNumbers(issues);

  // Summary
  if (issues.length > 0) {
    console.error(`[integrity] ⚠️  Found ${issues.length} data integrity issue(s):`);
    issues.forEach((issue, i) => console.error(`[integrity]   ${i + 1}. ${issue}`));
    console.error('[integrity] Please fix these issues in the Supabase dashboard to avoid unexpected behavior.');
  } else {
    console.log('[integrity] ✅ All integrity checks passed.');
  }
}

/**
 * Detects duplicate twilio_phone_number values across contractors.
 * This causes .single() lookups to fail with "Cannot coerce the result to a single JSON object".
 */
async function checkDuplicateTwilioNumbers(issues: string[]): Promise<void> {
  try {
    const { data: contractors, error } = await supabase
      .from('contractors')
      .select('id, business_name, twilio_phone_number')
      .not('twilio_phone_number', 'is', null);

    if (error) {
      console.warn('[integrity] Could not check for duplicate Twilio numbers:', error.message);
      return;
    }

    if (!contractors || contractors.length === 0) return;

    // Group by twilio_phone_number
    const byNumber = new Map<string, typeof contractors>();
    for (const c of contractors) {
      const num = c.twilio_phone_number;
      if (!num) continue;
      const existing = byNumber.get(num) || [];
      existing.push(c);
      byNumber.set(num, existing);
    }

    for (const [number, entries] of byNumber) {
      if (entries.length > 1) {
        const names = entries.map((e) => `"${e.business_name}" (${e.id})`).join(', ');
        issues.push(
          `DUPLICATE Twilio number ${number} assigned to ${entries.length} contractors: ${names}`
        );
      }
    }
  } catch (err) {
    console.warn('[integrity] Error during duplicate Twilio number check:', err);
  }
}

/**
 * Detects contractors without a Twilio phone number configured.
 * These contractors won't be reachable via voice webhooks.
 */
async function checkMissingTwilioNumbers(issues: string[]): Promise<void> {
  try {
    const { data: contractors, error } = await supabase
      .from('contractors')
      .select('id, business_name, twilio_phone_number')
      .or('twilio_phone_number.is.null,twilio_phone_number.eq.');

    if (error) {
      console.warn('[integrity] Could not check for missing Twilio numbers:', error.message);
      return;
    }

    if (contractors && contractors.length > 0) {
      for (const c of contractors) {
        issues.push(
          `Contractor "${c.business_name}" (${c.id}) has no Twilio phone number configured`
        );
      }
    }
  } catch (err) {
    console.warn('[integrity] Error during missing Twilio number check:', err);
  }
}
