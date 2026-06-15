import * as admin from 'firebase-admin';
import { env } from '../config/env';
import { supabase } from '../config/supabase';

// ---------------------------------------------------------------------------
// Firebase Admin SDK — graceful initialization
// If the service account file is missing, push notifications are disabled
// but the rest of the backend continues to work.
// ---------------------------------------------------------------------------

let firebaseInitialized = false;

try {
  if (!admin.apps.length) {
    let serviceAccount: admin.ServiceAccount | null = null;

    // Priority: base64 secret > inline JSON > file path
    if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded);
      console.log('[fcm] Using FIREBASE_SERVICE_ACCOUNT_B64');
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      console.log('[fcm] Using FIREBASE_SERVICE_ACCOUNT_JSON');
    } else if (env.firebaseServiceAccountPath) {
      // Fallback to file path (for local development)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      serviceAccount = require(env.firebaseServiceAccountPath);
      console.log('[fcm] Using FIREBASE_SERVICE_ACCOUNT_PATH');
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('[fcm] Firebase Admin SDK initialized');
    }
  } else if (admin.apps.length) {
    firebaseInitialized = true;
  }
} catch (err) {
  console.warn(
    `[fcm] Firebase not initialized — push notifications disabled. ` +
    `Reason: ${err instanceof Error ? err.message : String(err)}`
  );
}

// ---------------------------------------------------------------------------
// Notification types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'missed_call'
  | 'booking_confirmed'
  | 'lead_status_change'
  | 'system_alert'
  | 'payment_notification'
  | 'custom_admin';

interface NotificationPreferences {
  missed_call?: boolean;
  booking_confirmed?: boolean;
  lead_status_change?: boolean;
  system_alert?: boolean;
  payment_notification?: boolean;
  custom_admin?: boolean;
}

// ---------------------------------------------------------------------------
// NotificationService — structured push notification sender
// ---------------------------------------------------------------------------

class NotificationService {
  /**
   * Check if a contractor has opted in to a given notification type.
   * System alerts are always sent regardless of preferences.
   */
  private async isOptedIn(
    contractorId: string,
    type: NotificationType
  ): Promise<boolean> {
    // System alerts always go through
    if (type === 'system_alert') return true;

    const { data: contractor } = await supabase
      .from('contractors')
      .select('notification_preferences')
      .eq('id', contractorId)
      .single();

    if (!contractor) return true; // default to sending if contractor not found

    const prefs = (contractor.notification_preferences || {}) as NotificationPreferences;
    // If the key doesn't exist, default to opted-in
    return prefs[type] !== false;
  }

  /**
   * Low-level FCM sender. Looks up the contractor's FCM token, checks
   * notification preferences, and delivers the push.
   */
  private async _send(
    contractorId: string,
    title: string,
    body: string,
    data: Record<string, string>,
    channel: 'leads' | 'urgent_leads',
    type: NotificationType
  ): Promise<void> {
    if (!firebaseInitialized) {
      console.warn(`[fcm] Skipping push for contractor ${contractorId} — Firebase not initialized`);
      return;
    }

    // Check notification preferences
    const optedIn = await this.isOptedIn(contractorId, type);
    if (!optedIn) {
      console.log(`[fcm] Contractor ${contractorId} opted out of '${type}' — skipping`);
      return;
    }

    // Look up the contractor's FCM token
    const { data: contractor, error } = await supabase
      .from('contractors')
      .select('id, fcm_token')
      .eq('id', contractorId)
      .single();

    if (error || !contractor) {
      console.error(`[fcm] Contractor ${contractorId} not found for push notification`);
      return;
    }

    const fcmToken: string | null = contractor.fcm_token || null;

    if (!fcmToken) {
      console.warn(`[fcm] No FCM token for contractor ${contractorId}, skipping push`);
      return;
    }

    const isUrgent = channel === 'urgent_leads';

    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data: { ...data, notification_type: type },
        android: {
          priority: 'high',
          notification: isUrgent
            ? {
                // Urgent channel: louder alarm-style sound, bypasses DND
                channelId: 'urgent_leads',
                sound: 'urgent_alarm',
                defaultVibrateTimings: false,
                vibrateTimingsMillis: [0, 500, 200, 500, 200, 500, 200, 500],
                notificationCount: 1,
              }
            : {
                channelId: 'leads',
                sound: 'default',
              },
        },
      });
      console.log(`[fcm] Push sent to contractor ${contractorId}: "${title}" (type=${type}, urgent=${isUrgent})`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // If the token is invalid/expired, clear it from the database
      if (
        errorMsg.includes('messaging/registration-token-not-registered') ||
        errorMsg.includes('messaging/invalid-registration-token')
      ) {
        console.warn(`[fcm] Stale token for contractor ${contractorId}, clearing`);
        await supabase
          .from('contractors')
          .update({ fcm_token: null })
          .eq('id', contractorId);
      }

      console.error(`[fcm] Failed to send push to contractor ${contractorId}:`, errorMsg);
    }
  }

  // -------------------------------------------------------------------------
  // Public notification methods
  // -------------------------------------------------------------------------

  /**
   * Missed call notification.
   */
  async sendMissedCall(
    contractorId: string,
    leadId: string,
    callerPhone: string,
    callCount: number
  ): Promise<void> {
    const title = callCount === 1 ? 'Missed Call' : `Repeat Caller (${callCount}x)`;
    const body = `Missed call from ${callerPhone}`;
    await this._send(
      contractorId,
      title,
      body,
      { leadId },
      'leads',
      'missed_call'
    );
  }

  /**
   * Booking confirmed notification — sent when a Calendly invitee.created event fires.
   */
  async sendBookingConfirmed(
    contractorId: string,
    leadId: string,
    callerDisplay: string,
    bookingTime: string
  ): Promise<void> {
    await this._send(
      contractorId,
      'New Booking!',
      `${callerDisplay} booked for ${bookingTime}`,
      { leadId },
      'leads',
      'booking_confirmed'
    );
  }

  /**
   * Lead status change notification.
   */
  async sendLeadStatusChange(
    contractorId: string,
    leadId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    await this._send(
      contractorId,
      'Lead Updated',
      `Lead status changed from ${oldStatus} to ${newStatus}`,
      { leadId, oldStatus, newStatus },
      'leads',
      'lead_status_change'
    );
  }

  /**
   * System alert — urgent channel, cannot be disabled by contractor.
   */
  async sendSystemAlert(
    contractorId: string,
    message: string
  ): Promise<void> {
    await this._send(
      contractorId,
      '⚠️ System Alert',
      message,
      { source: 'system' },
      'urgent_leads',
      'system_alert'
    );
  }

  /**
   * Payment notification (future: Stripe webhook).
   */
  async sendPaymentNotification(
    contractorId: string,
    message: string
  ): Promise<void> {
    await this._send(
      contractorId,
      'Payment Update',
      message,
      { source: 'payment' },
      'leads',
      'payment_notification'
    );
  }

  /**
   * Custom admin notification — sent from the admin dashboard.
   */
  async sendCustom(
    contractorId: string,
    title: string,
    body: string
  ): Promise<void> {
    await this._send(
      contractorId,
      title,
      body,
      { type: 'custom_admin', source: 'admin_dashboard' },
      'leads',
      'custom_admin'
    );
  }
}

// Singleton instance
export const notificationService = new NotificationService();

// ---------------------------------------------------------------------------
// Backward compatibility — keep the old function signature working
// so we don't break anything during migration.
// ---------------------------------------------------------------------------
export async function sendPushNotification(
  contractorId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  await notificationService.sendCustom(contractorId, title, body);
}
