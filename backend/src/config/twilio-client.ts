import Twilio from 'twilio';
import { env } from './env';

/**
 * Creates a Twilio client using the restricted API key if available,
 * falling back to the Auth Token if not.
 *
 * The restricted API key follows least-privilege: it only has permissions
 * for Messaging (create/read), Voice (create), and Lookup (fetch).
 *
 * The Auth Token is still required separately for webhook signature
 * validation (see middleware/twilio-signature.ts).
 */
export function createTwilioClient(): ReturnType<typeof Twilio> {
  if (env.twilioApiKeySid && env.twilioApiKeySecret) {
    console.log('[twilio] Using restricted API key for API calls');
    return Twilio(env.twilioApiKeySid, env.twilioApiKeySecret, {
      accountSid: env.twilioAccountSid,
    });
  }

  console.warn('[twilio] Using Auth Token for API calls (less secure — set TWILIO_API_KEY_SID/SECRET)');
  return Twilio(env.twilioAccountSid, env.twilioAuthToken);
}

/**
 * Shared Twilio client instance — use this everywhere except webhook
 * signature validation.
 */
export const twilioClient = createTwilioClient();
