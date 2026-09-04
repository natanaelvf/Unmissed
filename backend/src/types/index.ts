// --- Enums ---

export enum LeadStatus {
  Missed = 'missed',
  ConsentSent = 'consent_sent',
  Qualifying = 'qualifying',
  QualifyingIssue = 'qualifying_issue',
  QualifyingUrgency = 'qualifying_urgency',
  QualifyingName = 'qualifying_name',
  QualifyingEmail = 'qualifying_email',      // New: asking caller for email
  BookingSent = 'booking_sent',
  CallbackPending = 'callback_pending',      // New: no booking enabled, callback promised
  Booked = 'booked',
  Completed = 'completed',
  FollowedUp = 'followed_up',
  DnrAlert = 'dnr_alert',
  NoConsent = 'no_consent',
}

export enum Urgency {
  Unknown = 'unknown',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Emergency = 'emergency',
}

export type NumberSetupType = 'forwarding' | 'new_number';
export type Tier = 'starter' | 'growth' | 'pro';
export type Locale = 'fi' | 'en' | 'pt';
export type MessageDirection = 'inbound' | 'outbound';
export type ScheduledTaskType = 'dnr_check' | 'satisfaction_followup' | 'reminder' | 'consent_timeout' | 'emergency_retry';

// --- Database row interfaces ---

export interface Contractor {
  id: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  twilio_phone_number: string;
  number_setup_type: NumberSetupType;
  // calendly_url removed — column kept in DB for backward compat only
  trade_type: string;
  default_job_value: number;
  urgency_threshold_urgent_min: number;
  urgency_threshold_normal_min: number;
  working_hours_start: string; // HH:MM
  working_hours_end: string;   // HH:MM
  working_days: number[];      // 0=Sun..6=Sat
  after_hours_emergency_policy: string;
  after_hours_ring: boolean;
  timezone: string;
  tier: Tier;
  locale: Locale;
  monthly_sms_cap: number;
  sms_used_this_month: number;
  stripe_customer_id: string | null;
  fcm_token: string | null;
  // Google Calendar integration
  calendar_booking_enabled: boolean;
  google_calendar_id: string | null;
  google_access_token: string | null;   // encrypted
  google_refresh_token: string | null;  // encrypted
  google_token_expiry: string | null;
  google_connected_at: string | null;
  booking_slot_duration_min: number;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  contractor_id: string;
  caller_phone: string;
  caller_name: string | null;
  caller_email: string | null;       // New: collected in QualifyingEmail step
  issue_description: string | null;
  urgency: Urgency;
  email: string | null;
  call_count: number;
  status: LeadStatus;
  consent_given: boolean;
  consent_given_at: string | null;
  booking_time: string | null;
  calendly_event_id: string | null;  // Legacy — kept for backward compat
  calendar_event_id: string | null;  // New: native Google Calendar event ID
  calendar_event_link: string | null; // New: htmlLink to Google Calendar event
  booking_token: string | null;       // New: JWT for booking page
  booking_token_expires_at: string | null;
  dnr_alert_sent: boolean;
  dnr_alert_sent_at: string | null;
  estimated_value: number | null;
  satisfaction_score: number | null;
  satisfaction_feedback: string | null;
  notes: string | null;
  called_during_after_hours: boolean;
  emergency_call_placed: boolean;
  locale: Locale;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  lead_id: string;
  direction: MessageDirection;
  body: string;
  twilio_message_sid: string | null;
  sent_at: string;
}

export interface ScheduledTask {
  id: string;
  lead_id: string;
  task_type: ScheduledTaskType;
  execute_at: string;
  executed: boolean;
  created_at: string;
}

// --- Twilio webhook bodies ---

export interface TwilioVoiceWebhookBody {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  ForwardedFrom?: string;
  CallerName?: string;
  ApiVersion: string;
}

export interface TwilioSmsWebhookBody {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  NumSegments: string;
}

// --- Express request augmentation ---

declare global {
  namespace Express {
    interface Request {
      contractorId?: string;
    }
  }
}
