# Contractor Onboarding Checklist

## Before the Call (Your Prep)
- [ ] Provision a new +358 Twilio number: `npx ts-node scripts/provision-number.ts`
- [ ] Note the number and keep it ready

## During the Onboarding Call (15-20 minutes)

### 1. Account Setup (5 min)
- [ ] Contractor downloads the app via Firebase App Distribution link
- [ ] Contractor opens app → taps "Create Account"
- [ ] Contractor fills in: business name, contact name, email, phone
- [ ] Contractor sets a password
- [ ] Account is created in Supabase Auth → contractor row is auto-created

### 2. Business Configuration (5 min)
- [ ] Contractor completes the onboarding screens:
  - Business info (name, trade type)
  - Contact details (email, phone)
  - Schedule (working days, hours, emergency policy)
- [ ] You provide their Twilio number and set it in the app (or via SQL)
- [ ] You provide their Calendly URL (or help them create a Calendly account)

### 3. Phone Forwarding (5 min)
Help the contractor set up call forwarding from their phone:

| Carrier | Unconditional Forward | Forward on No-Answer |
|---|---|---|
| **Elisa** | `**21*{twilio_number_no_plus}#` | `**61*{twilio_number_no_plus}#` |
| **Telia** | `**21*{twilio_number_no_plus}#` | `**61*{twilio_number_no_plus}#` |
| **DNA** | `**21*{twilio_number_no_plus}#` | `**61*{twilio_number_no_plus}#` |

**Recommended**: Use `**61*` (forward on no-answer) so the contractor still has a chance to answer first. If they want fully hands-off, use `**21*` (unconditional).

**To cancel forwarding**: `##21#` (unconditional) or `##61#` (no-answer).

### 4. Calendly Setup (5 min, if needed)
If the contractor doesn't have Calendly:
- [ ] Create a free Calendly account at [calendly.com](https://calendly.com)
- [ ] Create an event type: "Takaisinsoitto" (15 min)
- [ ] **Add a phone number question** (REQUIRED for booking matching)
- [ ] Set availability to match their working hours
- [ ] Copy the booking URL → paste it in the app settings

### 5. Test Call (2 min)
- [ ] Call the contractor's original number from your phone
- [ ] Let it ring → should forward to Twilio → voicemail plays
- [ ] Check the app — lead should appear within 30 seconds
- [ ] Reply to the SMS on your test phone
- [ ] Verify the conversation flows correctly

## After Onboarding

### Week 1 Monitoring
- [ ] Check Sentry for any errors related to this contractor
- [ ] Verify at least 1-2 real missed calls have been processed
- [ ] Call the contractor to ask how things are going
- [ ] Check their SMS usage (are they hitting the cap?)

### Week 2 Follow-up
- [ ] Review their lead pipeline in the app
- [ ] Ask about any leads that didn't convert — identify improvements
- [ ] Discuss upgrading tier if they're hitting SMS limits
