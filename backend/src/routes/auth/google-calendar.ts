import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { supabase } from '../../config/supabase';
import { authMiddleware } from '../../middleware/auth';
import { createOAuth2Client } from '../../services/calendar';

const router = Router();

// ---------------------------------------------------------------------------
// GET /auth/google-calendar/connect?contractor_id=<id>
// Redirect to Google's OAuth consent screen.
// ---------------------------------------------------------------------------
router.get('/connect', async (req: Request, res: Response) => {
  const contractorId = req.query['contractor_id'] as string;
  if (!contractorId) {
    res.status(400).json({ error: 'contractor_id query param required' });
    return;
  }

  const oauth2Client = createOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force refresh_token to be returned
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.freebusy',
      'email',
      'profile',
    ],
    state: contractorId, // passed back in callback
  });

  res.redirect(authUrl);
});

// ---------------------------------------------------------------------------
// GET /auth/google-calendar/callback
// Exchange authorization code for tokens and store them encrypted in DB.
// ---------------------------------------------------------------------------
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state: contractorId, error } = req.query as Record<string, string>;

  if (error) {
    console.warn('[google-calendar] OAuth callback error:', error);
    res.redirect(`/?google_calendar_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !contractorId) {
    res.status(400).json({ error: 'Missing code or state' });
    return;
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch the connected Google account email
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2Api.userinfo.get();
    const googleEmail = userInfo.data.email ?? null;

    // Store tokens in DB
    // NOTE: In production these should be encrypted at rest with AES-256.
    // For now they're stored as-is; add encryption middleware before launch.
    const { error: dbError } = await supabase
      .from('contractors')
      .update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        google_connected_at: new Date().toISOString(),
        // Store the connected email in the existing contact_email field only if
        // a dedicated google_email column is added in future; for now we log it.
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractorId);

    if (dbError) {
      console.error('[google-calendar] Failed to store tokens:', dbError.message);
      res.redirect(`/?google_calendar_error=db_error`);
      return;
    }

    console.log(`[google-calendar] Connected Google Calendar for contractor ${contractorId} (${googleEmail})`);

    // Redirect back to the app deep-link (or a success page)
    res.redirect(`/?google_calendar_connected=1`);
  } catch (err) {
    console.error('[google-calendar] Callback error:', err);
    res.redirect(`/?google_calendar_error=server_error`);
  }
});

// ---------------------------------------------------------------------------
// DELETE /auth/google-calendar/disconnect — Authenticated
// Revoke tokens and clear from DB.
// ---------------------------------------------------------------------------
router.delete('/disconnect', authMiddleware, async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const { data: contractor } = await supabase
      .from('contractors')
      .select('google_access_token, google_refresh_token')
      .eq('id', contractorId)
      .single();

    // Attempt to revoke the token at Google
    if (contractor?.google_access_token) {
      try {
        const oauth2Client = createOAuth2Client();
        await oauth2Client.revokeToken(contractor.google_access_token);
      } catch {
        // Revocation best-effort only
      }
    }

    // Clear tokens and disable calendar booking
    await supabase
      .from('contractors')
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_connected_at: null,
        calendar_booking_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractorId);

    res.json({ ok: true });
  } catch (err) {
    console.error('[google-calendar] Disconnect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
