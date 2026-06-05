# Unmissed

**Automatically recover missed calls, book jobs, and track revenue — so you never lose a lead again.**

Unmissed is a hands-off lead recovery platform built for home service contractors. When you miss a call, the system detects it instantly, reaches out to your caller via SMS, qualifies their issue, and books a callback on your calendar — all without you lifting a finger.

---

## The Problem

Every missed call is a potential customer calling your competitor instead. You're on a job, your hands are full, and the phone keeps ringing. By the time you check your missed calls at the end of the day, those leads have already moved on.

Unmissed catches those calls the moment you miss them — and turns them into booked jobs.

---

## How It Works

```
1. MISSED CALL        →  Twilio detects the unanswered call instantly
2. SMS ENGAGEMENT     →  System texts the caller within seconds, asks what they need
3. AUTOMATIC BOOKING  →  Sends them your Calendly link to book a callback
4. YOU GET NOTIFIED   →  Push notification with name, issue, urgency, and booking time
```

The entire flow happens automatically. You see the result: a booked job on your calendar with full context.

---

## Features

### Automatic Lead Recovery
- **Instant SMS outreach** — Within seconds of a missed call, the caller receives a text
- **Smart qualification** — Collects the issue description, urgency level, and caller name
- **GDPR-compliant consent** — First message is always a consent gate
- **Deduplication** — Multiple calls from the same number = one lead, with call count tracked

### Calendar & Booking
- **Calendly integration** — Callers book directly on your schedule
- **Booking confirmation** — Both you and the caller get confirmation via SMS and push notification
- **Calendar view** — See today's and upcoming booked callbacks at a glance

### Real-Time Monitoring
- **Live lead feed** — Every lead appears instantly in the app and web dashboard
- **Conversation logs** — Full SMS thread visible for every lead
- **Status tracking** — See exactly where each lead is in the pipeline (missed → contacted → booked → completed)
- **Push notifications** — New leads, bookings, and urgent alerts sent to your phone

### Revenue & Performance
- **Revenue dashboard** — See how much recovered leads are worth
- **Monthly statistics** — Leads recovered, recovery rate, average response time
- **Month-over-month trends** — Track improvement over time

### Caller Identification
- **Automatic name resolution** — Know who called before they even reply (via Twilio Lookup)
- **Opt-in per contractor** — You control whether caller lookup is active

### Emergency Handling
- **Urgency detection** — Callers rate their urgency (1-4 scale)
- **Emergency alerts** — High-urgency leads trigger an immediate phone call to you
- **After-hours policy** — Set your working hours and emergency override rules

### Satisfaction Tracking
- **Automated follow-up** — 24 hours after job completion, the caller receives a satisfaction survey
- **Score tracking** — 1-5 rating with optional feedback
- **Low score alerts** — Get notified immediately if a customer is unhappy

### GDPR Compliance (EU)
- **Explicit consent** — Every lead must opt in before any data is collected
- **Full data deletion** — One-click GDPR deletion removes all lead data with audit logging
- **EU data residency** — All data stored in Frankfurt (Supabase EU)
- **Privacy policy & DPA** — Templates included, ready for legal review

---

## What You Get

| Feature | Starter (€149/mo) | Growth (€249/mo) | Pro (€399/mo) |
|---|---|---|---|
| Missed call recovery | ✓ | ✓ | ✓ |
| SMS qualification sequence | ✓ | ✓ | ✓ |
| Calendly booking | ✓ | ✓ | ✓ |
| Push notifications | ✓ | ✓ | ✓ |
| Revenue dashboard | ✓ | ✓ | ✓ |
| Monthly SMS cap | 50 | 150 | Unlimited |
| Satisfaction follow-ups | — | ✓ | ✓ |
| Priority support | — | ✓ | ✓ |
| Custom SMS templates | — | — | ✓ |
| API access | — | — | ✓ |

---

## Why Unmissed

- **Completely hands-off** — No app to check, no calls to return manually. The system handles everything.
- **Works with your existing number** — Set up call forwarding from your current number. No need to change your published phone number.
- **See everything in one place** — Mobile app + web dashboard. Full visibility into every lead, conversation, and booking.
- **Built for contractors** — Not a generic CRM. Designed for plumbers, HVAC techs, electricians, and roofers who work with their hands all day.
- **Multilingual** — Finnish and English SMS templates included. Portuguese available.
- **GDPR-ready** — Privacy policy, consent gating, and data deletion built in from day one.

---

## Architecture

```
Lead calls → Twilio (missed call detection) → Node.js backend → Supabase
                                                    ↓
                                              SMS sequence
                                              (consent → issue → urgency → name → booking link)
                                                    ↓
                                              Calendly booking → confirmation → satisfaction follow-up
```

### Tech Stack

- **Backend**: Node.js (TypeScript) on Fly.io (EU region)
- **Database**: Supabase (PostgreSQL, Frankfurt EU) with Row Level Security
- **SMS/Voice**: Twilio Programmable Messaging + Voice
- **Booking**: Calendly webhooks
- **Mobile App**: Flutter (Android) with Supabase Realtime + Firebase Push
- **Web Dashboard**: Vanilla JS SPA with Supabase client
- **Auth**: Supabase Auth (email/password)

---

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account (project in Frankfurt EU)
- Twilio account with a Finnish +358 number
- Calendly account (free tier)
- Flutter SDK (for the mobile app)
- Firebase project (for FCM push notifications)

### Setup

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd missed-lead-recovery
   ```

2. **Set up environment variables:**
   ```bash
   cp backend/.env.example backend/.env
   # Fill in: SUPABASE_URL, SUPABASE_SERVICE_KEY, TWILIO_SID, TWILIO_AUTH_TOKEN,
   #          TWILIO_PHONE_NUMBER, CALENDLY_WEBHOOK_SECRET, FCM_SERVER_KEY
   ```

3. **Apply the database schema:**
   ```bash
   # Run database/setup_prod.sql in the Supabase SQL editor
   ```

4. **Install and start the backend:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

5. **Start the web dashboard:**
   ```bash
   cd frontend
   npm install
   # Create .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   npm run dev
   ```

6. **Build the Flutter app:**
   ```bash
   cd app
   flutter pub get
   flutter run
   ```

---

## Documentation

- **[Implementation Plan](docs/implementation_plan.md)** — Full architecture, database schema, workflow detail, GDPR requirements, pricing, and timeline.
- **[Tasks](docs/tasks.md)** — Phased task breakdown across setup, backend, app, GDPR, testing, and onboarding.
- **[Visual Identity](docs/visual-identity.md)** — Brand guidelines, color palette, typography.
- **[Privacy Policy](docs/privacy-policy.md)** — GDPR-compliant privacy policy template.
- **[DPA Template](docs/dpa-template.md)** — Data Processing Agreement for contractors.
- **[Onboarding Checklist](docs/onboarding-checklist.md)** — Step-by-step contractor onboarding guide.
- **[Sales Playbook](docs/SELLING.md)** — Demo flow, objection handling, cold outreach scripts.

---

## License

AGPL-3.0 — See [LICENSE](LICENSE) for details.
