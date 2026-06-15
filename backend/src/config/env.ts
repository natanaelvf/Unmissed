import dotenv from 'dotenv';
import path from 'path';

// Load environment-specific .env file based on NODE_ENV.
// Defaults to .env.dev for local development.
const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Fallback: also try plain .env for backward compatibility
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Optional env var — logs a warning if missing and returns the fallback.
 * Use for services that can degrade gracefully (FCM, Calendly).
 */
function optional(key: string, fallback: string, warningMsg: string): string {
  const value = process.env[key];
  if (!value) {
    console.warn(`[env] ${warningMsg}`);
    return fallback;
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_KEY'),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  twilioAccountSid: required('TWILIO_ACCOUNT_SID'),
  twilioAuthToken: required('TWILIO_AUTH_TOKEN'),
  // Restricted API key — used for all Twilio API calls (least-privilege)
  twilioApiKeySid: optional(
    'TWILIO_API_KEY_SID',
    '',
    'TWILIO_API_KEY_SID not set — falling back to Auth Token for API calls (less secure)'
  ),
  twilioApiKeySecret: optional(
    'TWILIO_API_KEY_SECRET',
    '',
    'TWILIO_API_KEY_SECRET not set — falling back to Auth Token for API calls (less secure)'
  ),
  twilioPhoneNumber: required('TWILIO_PHONE_NUMBER'),
  // Optional: Calendly webhook signature verification is disabled if not set
  calendlyWebhookSecret: optional(
    'CALENDLY_WEBHOOK_SECRET',
    '',
    'CALENDLY_WEBHOOK_SECRET not set — Calendly webhook signature verification is DISABLED'
  ),
  // Optional: Push notifications are disabled if Firebase service account is not set
  // TODO: Test with frontend integration once Firebase project is created
  firebaseServiceAccountPath: optional(
    'FIREBASE_SERVICE_ACCOUNT_PATH',
    '',
    'FIREBASE_SERVICE_ACCOUNT_PATH not set — push notifications are DISABLED'
  ),
  googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  betterstackApiToken: optional(
    'BETTERSTACK_API_TOKEN',
    '',
    'BETTERSTACK_API_TOKEN not set — uptime monitor API integration disabled'
  ),
  // Admin user IDs — comma-separated UUIDs of users with admin access
  adminUserIds: (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  // Base URL of the deployed app (used for Twilio webhook configuration)
  appBaseUrl: process.env.APP_BASE_URL || '',
} as const;
