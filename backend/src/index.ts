import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cron from 'node-cron';
import * as Sentry from '@sentry/node';
import { env } from './config/env';

// --- Route imports ---
import twilioVoiceWebhook from './routes/webhooks/twilio-voice';
import twilioSmsWebhook from './routes/webhooks/twilio-sms';
import deviceTokenRoute from './routes/api/device-token';
import leadsRoute from './routes/api/leads';
import statsRoute from './routes/api/stats';
import contractorRoute from './routes/api/contractor';
import voicemailRoute from './routes/api/voicemail';
import adminRoute from './routes/api/admin';
import calendarStatusRoute from './routes/api/calendar-status';
import googleCalendarAuthRoute from './routes/auth/google-calendar';
import publicBookingRoute from './routes/public/booking';

// --- Middleware imports ---
import { twilioSignatureMiddleware } from './middleware/twilio-signature';
import { authMiddleware } from './middleware/auth';
import { adminAuthMiddleware } from './middleware/admin-auth';
import { apiRateLimiter, webhookRateLimiter } from './middleware/rate-limit';

// --- Cron job imports ---
import { runDnrCheck } from './jobs/dnr-check';
import { runSatisfactionFollowup } from './jobs/satisfaction-followup';
import { runDataRetention } from './jobs/data-retention';
import { runConsentTimeout } from './jobs/consent-timeout';
import { runSmsReset } from './jobs/sms-reset';
import { runIntegrityCheck } from './jobs/integrity-check';
import { runEmergencyRetry } from './jobs/emergency-retry';

const app = express();

// --- Sentry error tracking ---
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: env.nodeEnv,
    tracesSampleRate: env.nodeEnv === 'production' ? 0.2 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });
  console.log('[sentry] Error tracking initialized');
} else {
  console.warn('[sentry] SENTRY_DSN not set — error tracking is DISABLED');
}

// Trust Fly.io's reverse proxy so express-rate-limit reads the correct client IP
// from X-Forwarded-For instead of throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);

// --- Middleware ---
app.use(helmet({
  // Allow the booking page to load Google Fonts
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
    },
  },
}));

// Fix #9: Restrict CORS to specific origins (mobile app doesn't need CORS,
// but keep it ready for a future web dashboard)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || false, // Disabled by default; set CORS_ORIGIN env var for web dashboard
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Parse JSON with raw body capture for webhook signature verification.
app.use(
  express.json({
    verify: (req: express.Request, _res, buf) => {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf-8');
    },
  })
);
app.use(express.urlencoded({ extended: true })); // Twilio sends form-encoded

// --- Static files (for voicemails and booking page) ---
app.use('/audio', express.static('public/audio'));

// --- Health check (used by BetterUptime / UptimeRobot) ---
const startedAt = new Date().toISOString();
app.get('/health', async (_req, res) => {
  try {
    // Verify Supabase connectivity (don't expose row counts)
    const { supabase } = await import('./config/supabase');
    const { error } = await supabase
      .from('contractors')
      .select('id', { count: 'exact', head: true });

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      startedAt,
      uptime: process.uptime(),
      database: error ? 'error' : 'connected',
      sentry: !!process.env.SENTRY_DSN,
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// --- Public booking page (no auth, no rate limit — but token-gated) ---
// Serves GET /book/:token (HTML) and POST/GET /api/public/* (JSON)
app.use('/book', publicBookingRoute);
app.use('/api/public', publicBookingRoute);

// --- Google Calendar OAuth (unauthenticated — Google redirects here) ---
app.use('/auth/google-calendar', googleCalendarAuthRoute);

// --- API routes (authenticated + rate limited) ---
app.use('/api', apiRateLimiter, authMiddleware,
  deviceTokenRoute, leadsRoute, statsRoute, contractorRoute, voicemailRoute, calendarStatusRoute);
app.use('/api/admin', apiRateLimiter, authMiddleware, adminAuthMiddleware, adminRoute);

// --- Webhook routes (validated by signature + rate limited) ---
// Fix #7: Apply Twilio signature validation to Twilio webhook routes
app.use('/webhooks/twilio-voice', webhookRateLimiter, twilioSignatureMiddleware, twilioVoiceWebhook);
app.use('/webhooks/twilio-sms', webhookRateLimiter, twilioSignatureMiddleware, twilioSmsWebhook);
// Note: Calendly webhook removed — fully replaced by native booking flow

// --- Cron jobs ---
// DNR check: every 15 minutes
cron.schedule('*/15 * * * *', () => {
  runDnrCheck().catch((err) => console.error('[cron] DNR check error:', err));
});

// Satisfaction follow-up: every 30 minutes
cron.schedule('*/30 * * * *', () => {
  runSatisfactionFollowup().catch((err) =>
    console.error('[cron] Satisfaction followup error:', err)
  );
});

// Consent timeout: every 5 minutes (fix #20)
cron.schedule('*/5 * * * *', () => {
  runConsentTimeout().catch((err) =>
    console.error('[cron] Consent timeout error:', err)
  );
  runEmergencyRetry().catch((err) =>
    console.error('[cron] Emergency retry error:', err)
  );
});

// Data retention: daily at 3:00 AM
cron.schedule('0 3 * * *', () => {
  runDataRetention().catch((err) =>
    console.error('[cron] Data retention error:', err)
  );
});

// Monthly SMS reset: 1st of each month at midnight
cron.schedule('0 0 1 * *', () => {
  runSmsReset().catch((err) =>
    console.error('[cron] SMS reset error:', err)
  );
});

// --- Sentry error handler (must be after all routes/middleware) ---
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// --- Start server ---
app.listen(env.port, () => {
  console.log(`🚀 Server running on port ${env.port}`);
  console.log(`   Health check: http://localhost:${env.port}/health`);

  // Run data integrity checks on startup (non-blocking)
  runIntegrityCheck().catch((err) => {
    console.error('[startup] Integrity check failed:', err);
    Sentry.captureException(err);
  });
});

export default app;
