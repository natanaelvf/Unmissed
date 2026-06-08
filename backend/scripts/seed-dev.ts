/**
 * Dev Seed Script — Generates realistic test leads across every status,
 * urgency, and lifecycle stage. Includes simulated conversations, costs,
 * ratings, notes, and scheduled tasks.
 *
 * Usage:
 *   npx tsx scripts/seed-dev.ts
 *
 * Prerequisites:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars set
 *   - A contractor row must already exist (the script uses the first one found)
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Finnish-style test data ─────────────────────────────────────────────

const FINNISH_NAMES = [
  'Matti Korhonen', 'Liisa Virtanen', 'Juha Nieminen', 'Anna Mäkelä',
  'Timo Hämäläinen', 'Sanna Laine', 'Pekka Heikkinen', 'Kaisa Koskinen',
  'Jari Järvinen', 'Elina Lehtonen', 'Markku Salminen', 'Tuula Heinonen',
  'Antti Ahonen', 'Hanna Niemi', 'Mikko Ranta', 'Laura Kallio',
];

const FINNISH_PHONES = FINNISH_NAMES.map((_, i) =>
  `+358 40 ${String(1000000 + i * 111111).slice(0, 7)}`
);

const ISSUES = [
  'Putkivuoto keittiössä, vesi valuu lattialle',
  'Vessan vetopainike jumissa, ei vetoa',
  'Lattialämmitys ei toimi eteisessä',
  'Tiskikoneen liitäntä vuotaa',
  'Suihkusekoitin ei säädä lämpöä',
  'Viemäri tukkeutunut, vesi ei laske',
  'Patterin termostaatti rikki',
  'Kylmävesiputki jäätynyt autotallissa',
  'Lämminvesivaraaja vuotaa pohjasta',
  'Pesukoneen sulkuventtiili ei mene kiinni',
  'Lavuaarin pohjaventtiili vuotaa',
  'Radiaattorin ilmaventtiili vuotaa',
  'Keittiön hana tippuu koko ajan',
  'WC-istuimen kiinnikkeet irrallaan',
  'Ulkohana ei sulkeudu kunnolla',
  'Kellarin lattiakaiivo tukkeutunut',
];

const NOTES_SAMPLES = [
  'Asiakas vaikutti kiireiseltä, kannattaa soittaa aamulla.',
  'Vanha kiinteistö, mahdollisesti kupariputket.',
  'Avaimet naapurilla, soita ensin 040-1234567.',
  'Asunto 3. kerroksessa, ei hissiä. Varaa aikaa.',
  null, null, null, null, // ~50% of leads have notes
];

// ── Lead blueprints covering every status + urgency combo ───────────────

interface SeedLead {
  status: string;
  urgency: string;
  consent_given: boolean;
  issue_description: string | null;
  caller_name: string | null;
  estimated_value: number | null;
  booking_time: string | null;
  satisfaction_score: number | null;
  satisfaction_feedback: string | null;
  notes: string | null;
  called_during_after_hours: boolean;
  dnr_alert_sent: boolean;
  call_count: number;
  /** How many days ago this lead was created */
  daysAgo: number;
  /** Simulated conversation messages (alternating inbound/outbound) */
  messages: { direction: 'inbound' | 'outbound'; body: string; hoursAfterCreation: number }[];
  costs: { description: string; amount: number }[];
}

function hoursAgo(daysAgo: number, hours: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() + hours);
  return d;
}

const SEED_LEADS: SeedLead[] = [
  // ── MISSED (brand new, no interaction yet) ────────────────────────
  {
    status: 'missed', urgency: 'unknown', consent_given: false,
    issue_description: null, caller_name: null, estimated_value: null,
    booking_time: null, satisfaction_score: null, satisfaction_feedback: null,
    notes: null, called_during_after_hours: false, dnr_alert_sent: false,
    call_count: 1, daysAgo: 0, messages: [], costs: [],
  },
  {
    status: 'missed', urgency: 'unknown', consent_given: false,
    issue_description: null, caller_name: null, estimated_value: null,
    booking_time: null, satisfaction_score: null, satisfaction_feedback: null,
    notes: null, called_during_after_hours: true, dnr_alert_sent: false,
    call_count: 2, daysAgo: 0, messages: [], costs: [],
  },

  // ── CONSENT_SENT (waiting for reply) ─────────────────────────────
  {
    status: 'consent_sent', urgency: 'unknown', consent_given: false,
    issue_description: null, caller_name: null, estimated_value: null,
    booking_time: null, satisfaction_score: null, satisfaction_feedback: null,
    notes: null, called_during_after_hours: false, dnr_alert_sent: false,
    call_count: 1, daysAgo: 0,
    messages: [
      { direction: 'outbound', body: 'Hei! Yritit soittaa...', hoursAfterCreation: 0 },
    ],
    costs: [],
  },

  // ── NO_CONSENT (declined) ────────────────────────────────────────
  {
    status: 'no_consent', urgency: 'unknown', consent_given: false,
    issue_description: null, caller_name: null, estimated_value: null,
    booking_time: null, satisfaction_score: null, satisfaction_feedback: null,
    notes: null, called_during_after_hours: false, dnr_alert_sent: false,
    call_count: 1, daysAgo: 3,
    messages: [
      { direction: 'outbound', body: 'Hei! Yritit soittaa...', hoursAfterCreation: 0 },
      { direction: 'inbound', body: 'EI', hoursAfterCreation: 0.5 },
      { direction: 'outbound', body: 'Ei hätää! Emme lähetä sinulle enää viestejä.', hoursAfterCreation: 0.5 },
    ],
    costs: [],
  },

  // ── QUALIFYING_ISSUE (just opted in, asking about issue) ─────────
  {
    status: 'qualifying_issue', urgency: 'unknown', consent_given: true,
    issue_description: null, caller_name: null, estimated_value: null,
    booking_time: null, satisfaction_score: null, satisfaction_feedback: null,
    notes: null, called_during_after_hours: false, dnr_alert_sent: false,
    call_count: 1, daysAgo: 1,
    messages: [
      { direction: 'outbound', body: 'Hei! Yritit soittaa...', hoursAfterCreation: 0 },
      { direction: 'inbound', body: 'KYLLÄ', hoursAfterCreation: 1 },
      { direction: 'outbound', body: 'Kiitos! Voitko lyhyesti kuvata ongelman...', hoursAfterCreation: 1 },
    ],
    costs: [],
  },

  // ── QUALIFYING_URGENCY (issue described, asking urgency) ─────────
  {
    status: 'qualifying_urgency', urgency: 'unknown', consent_given: true,
    issue_description: 'Putkivuoto keittiössä', caller_name: null, estimated_value: null,
    booking_time: null, satisfaction_score: null, satisfaction_feedback: null,
    notes: null, called_during_after_hours: false, dnr_alert_sent: false,
    call_count: 1, daysAgo: 1,
    messages: [
      { direction: 'outbound', body: 'Hei! Yritit soittaa...', hoursAfterCreation: 0 },
      { direction: 'inbound', body: 'KYLLÄ', hoursAfterCreation: 0.5 },
      { direction: 'outbound', body: 'Kiitos! Voitko lyhyesti kuvata...', hoursAfterCreation: 0.5 },
      { direction: 'inbound', body: 'Putkivuoto keittiössä', hoursAfterCreation: 1 },
      { direction: 'outbound', body: 'Kuinka kiireellinen asia on? 1-4', hoursAfterCreation: 1 },
    ],
    costs: [],
  },

  // ── QUALIFYING_NAME (urgency set, asking name) — LOW urgency ─────
  {
    status: 'qualifying_name', urgency: 'low', consent_given: true,
    issue_description: 'Keittiön hana tippuu', caller_name: null, estimated_value: null,
    booking_time: null, satisfaction_score: null, satisfaction_feedback: null,
    notes: null, called_during_after_hours: false, dnr_alert_sent: false,
    call_count: 1, daysAgo: 2,
    messages: [
      { direction: 'outbound', body: 'Hei! Yritit soittaa...', hoursAfterCreation: 0 },
      { direction: 'inbound', body: 'KYLLÄ', hoursAfterCreation: 0.3 },
      { direction: 'outbound', body: 'Kiitos! Voitko lyhyesti kuvata...', hoursAfterCreation: 0.3 },
      { direction: 'inbound', body: 'Keittiön hana tippuu', hoursAfterCreation: 0.8 },
      { direction: 'outbound', body: 'Kuinka kiireellinen? 1-4', hoursAfterCreation: 0.8 },
      { direction: 'inbound', body: '1', hoursAfterCreation: 1.2 },
      { direction: 'outbound', body: 'Kiitos! Millä nimellä voimme kutsua sinua?', hoursAfterCreation: 1.2 },
    ],
    costs: [],
  },

  // ── BOOKING_SENT — MEDIUM urgency ────────────────────────────────
  {
    status: 'booking_sent', urgency: 'medium', consent_given: true,
    issue_description: 'Suihkusekoitin ei toimi', caller_name: 'Liisa Virtanen',
    estimated_value: 280, booking_time: null, satisfaction_score: null,
    satisfaction_feedback: null, notes: NOTES_SAMPLES[0], called_during_after_hours: false,
    dnr_alert_sent: false, call_count: 1, daysAgo: 2,
    messages: [
      { direction: 'outbound', body: 'Hei! Yritit soittaa...', hoursAfterCreation: 0 },
      { direction: 'inbound', body: 'KYLLÄ', hoursAfterCreation: 0.2 },
      { direction: 'outbound', body: 'Voitko kuvata ongelman?', hoursAfterCreation: 0.2 },
      { direction: 'inbound', body: 'Suihkusekoitin ei toimi', hoursAfterCreation: 0.5 },
      { direction: 'outbound', body: 'Kuinka kiireellinen? 1-4', hoursAfterCreation: 0.5 },
      { direction: 'inbound', body: '2', hoursAfterCreation: 0.7 },
      { direction: 'outbound', body: 'Millä nimellä voimme kutsua sinua?', hoursAfterCreation: 0.7 },
      { direction: 'inbound', body: 'Liisa Virtanen', hoursAfterCreation: 1 },
      { direction: 'outbound', body: 'Kiitos! Varaa aika: https://calendly.com/...', hoursAfterCreation: 1 },
    ],
    costs: [],
  },

  // ── BOOKED — HIGH urgency ────────────────────────────────────────
  {
    status: 'booked', urgency: 'high', consent_given: true,
    issue_description: 'Viemäri tukkeutunut, vesi ei laske', caller_name: 'Juha Nieminen',
    estimated_value: 450,
    booking_time: new Date(Date.now() + 2 * 86400000).toISOString(), // 2 days from now
    satisfaction_score: null, satisfaction_feedback: null,
    notes: NOTES_SAMPLES[1], called_during_after_hours: false,
    dnr_alert_sent: false, call_count: 1, daysAgo: 3,
    messages: [
      { direction: 'outbound', body: 'Hei! Yritit soittaa...', hoursAfterCreation: 0 },
      { direction: 'inbound', body: 'KYLLÄ', hoursAfterCreation: 0.1 },
      { direction: 'outbound', body: 'Voitko kuvata ongelman?', hoursAfterCreation: 0.1 },
      { direction: 'inbound', body: 'Viemäri tukkeutunut', hoursAfterCreation: 0.3 },
      { direction: 'outbound', body: 'Kuinka kiireellinen? 1-4', hoursAfterCreation: 0.3 },
      { direction: 'inbound', body: '3', hoursAfterCreation: 0.4 },
      { direction: 'outbound', body: 'Millä nimellä?', hoursAfterCreation: 0.4 },
      { direction: 'inbound', body: 'Juha Nieminen', hoursAfterCreation: 0.5 },
      { direction: 'outbound', body: '⚡ Varaa ensimmäinen vapaa aika...', hoursAfterCreation: 0.5 },
    ],
    costs: [],
  },

  // ── COMPLETED — EMERGENCY, with costs and rating ─────────────────
  {
    status: 'completed', urgency: 'emergency', consent_given: true,
    issue_description: 'Kylmävesiputki jäätynyt autotallissa, vesi suihkuaa!',
    caller_name: 'Timo Hämäläinen', estimated_value: 850,
    booking_time: new Date(Date.now() - 5 * 86400000).toISOString(),
    satisfaction_score: 5, satisfaction_feedback: 'Tosi nopeaa palvelua, kiitos!',
    notes: NOTES_SAMPLES[2], called_during_after_hours: true,
    dnr_alert_sent: false, call_count: 3, daysAgo: 7,
    messages: [
      { direction: 'outbound', body: 'Hei! Yritit soittaa...', hoursAfterCreation: 0 },
      { direction: 'inbound', body: 'KYLLÄ', hoursAfterCreation: 0.05 },
      { direction: 'outbound', body: 'Voitko kuvata ongelman?', hoursAfterCreation: 0.05 },
      { direction: 'inbound', body: 'Vesiputki jäätynyt, vesi suihkuaa!', hoursAfterCreation: 0.1 },
      { direction: 'outbound', body: 'Kuinka kiireellinen? 1-4', hoursAfterCreation: 0.1 },
      { direction: 'inbound', body: '4', hoursAfterCreation: 0.12 },
      { direction: 'outbound', body: 'Millä nimellä?', hoursAfterCreation: 0.12 },
      { direction: 'inbound', body: 'Timo Hämäläinen', hoursAfterCreation: 0.15 },
      { direction: 'outbound', body: '🚨 Soitamme sinulle heti takaisin!', hoursAfterCreation: 0.15 },
    ],
    costs: [
      { description: 'Hätätyö, iltalisä', amount: 120 },
      { description: 'Putken vaihto (materiaali)', amount: 85 },
      { description: 'Työ 2h', amount: 180 },
    ],
  },

  // ── COMPLETED — LOW, cheap job ───────────────────────────────────
  {
    status: 'completed', urgency: 'low', consent_given: true,
    issue_description: 'Lavuaarin pohjaventtiili vuotaa',
    caller_name: 'Kaisa Koskinen', estimated_value: 120,
    booking_time: new Date(Date.now() - 10 * 86400000).toISOString(),
    satisfaction_score: 4, satisfaction_feedback: null,
    notes: null, called_during_after_hours: false,
    dnr_alert_sent: false, call_count: 1, daysAgo: 14,
    messages: [
      { direction: 'outbound', body: 'Hei! Yritit soittaa...', hoursAfterCreation: 0 },
      { direction: 'inbound', body: 'KYLLÄ', hoursAfterCreation: 2 },
      { direction: 'outbound', body: 'Voitko kuvata?', hoursAfterCreation: 2 },
      { direction: 'inbound', body: 'Lavuaarin pohjaventtiili vuotaa', hoursAfterCreation: 3 },
      { direction: 'outbound', body: 'Kuinka kiireellinen?', hoursAfterCreation: 3 },
      { direction: 'inbound', body: '1', hoursAfterCreation: 4 },
      { direction: 'outbound', body: 'Millä nimellä?', hoursAfterCreation: 4 },
      { direction: 'inbound', body: 'Kaisa Koskinen', hoursAfterCreation: 5 },
      { direction: 'outbound', body: 'Varaa sopiva aika...', hoursAfterCreation: 5 },
    ],
    costs: [{ description: 'Pohjaventtiili + työ', amount: 65 }],
  },

  // ── FOLLOWED_UP (satisfaction SMS sent, waiting for reply) ────────
  {
    status: 'followed_up', urgency: 'medium', consent_given: true,
    issue_description: 'Patterin termostaatti rikki',
    caller_name: 'Sanna Laine', estimated_value: 350,
    booking_time: new Date(Date.now() - 3 * 86400000).toISOString(),
    satisfaction_score: null, satisfaction_feedback: null,
    notes: NOTES_SAMPLES[3], called_during_after_hours: false,
    dnr_alert_sent: false, call_count: 1, daysAgo: 8,
    messages: [
      { direction: 'outbound', body: 'Hei! Yritit soittaa...', hoursAfterCreation: 0 },
      { direction: 'inbound', body: 'KYLLÄ', hoursAfterCreation: 1 },
      { direction: 'outbound', body: 'Voitko kuvata?', hoursAfterCreation: 1 },
      { direction: 'inbound', body: 'Patterin termostaatti rikki', hoursAfterCreation: 2 },
      { direction: 'outbound', body: 'Kuinka kiireellinen?', hoursAfterCreation: 2 },
      { direction: 'inbound', body: '2', hoursAfterCreation: 3 },
      { direction: 'outbound', body: 'Millä nimellä?', hoursAfterCreation: 3 },
      { direction: 'inbound', body: 'Sanna Laine', hoursAfterCreation: 4 },
      { direction: 'outbound', body: 'Varaa aika...', hoursAfterCreation: 4 },
      { direction: 'outbound', body: 'Miten kokemuksesi sujui? Vastaa 1-5', hoursAfterCreation: 96 },
    ],
    costs: [{ description: 'Termostaatti', amount: 45 }, { description: 'Asennustyö', amount: 90 }],
  },

  // ── DNR_ALERT (do not respond) ───────────────────────────────────
  {
    status: 'dnr_alert', urgency: 'high', consent_given: true,
    issue_description: 'Lämminvesivaraaja vuotaa pohjasta',
    caller_name: 'Markku Salminen', estimated_value: 600,
    booking_time: null, satisfaction_score: null, satisfaction_feedback: null,
    notes: 'Asiakas ei vastaa puheluihin. Lähetetty DNR-ilmoitus.',
    called_during_after_hours: false, dnr_alert_sent: true,
    call_count: 4, daysAgo: 5,
    messages: [
      { direction: 'outbound', body: 'Hei! Yritit soittaa...', hoursAfterCreation: 0 },
      { direction: 'inbound', body: 'KYLLÄ', hoursAfterCreation: 0.5 },
      { direction: 'outbound', body: 'Voitko kuvata?', hoursAfterCreation: 0.5 },
      { direction: 'inbound', body: 'Lämminvesivaraaja vuotaa', hoursAfterCreation: 1 },
      { direction: 'outbound', body: 'Kuinka kiireellinen?', hoursAfterCreation: 1 },
      { direction: 'inbound', body: '3', hoursAfterCreation: 1.5 },
      { direction: 'outbound', body: 'Millä nimellä?', hoursAfterCreation: 1.5 },
      { direction: 'inbound', body: 'Markku Salminen', hoursAfterCreation: 2 },
      { direction: 'outbound', body: '⚡ Varaa ensimmäinen vapaa aika...', hoursAfterCreation: 2 },
    ],
    costs: [],
  },

  // ── COMPLETED — MEDIUM, with rating 2 (low satisfaction) ─────────
  {
    status: 'completed', urgency: 'medium', consent_given: true,
    issue_description: 'Tiskikoneen liitäntä vuotaa',
    caller_name: 'Elina Lehtonen', estimated_value: 200,
    booking_time: new Date(Date.now() - 12 * 86400000).toISOString(),
    satisfaction_score: 2, satisfaction_feedback: 'Odotusaika oli liian pitkä.',
    notes: null, called_during_after_hours: false,
    dnr_alert_sent: false, call_count: 1, daysAgo: 15,
    messages: [
      { direction: 'outbound', body: 'Hei! Yritit soittaa...', hoursAfterCreation: 0 },
      { direction: 'inbound', body: 'KYLLÄ', hoursAfterCreation: 3 },
      { direction: 'outbound', body: 'Voitko kuvata?', hoursAfterCreation: 3 },
      { direction: 'inbound', body: 'Tiskikoneen liitäntä vuotaa', hoursAfterCreation: 5 },
      { direction: 'outbound', body: 'Kuinka kiireellinen?', hoursAfterCreation: 5 },
      { direction: 'inbound', body: '2', hoursAfterCreation: 6 },
      { direction: 'outbound', body: 'Millä nimellä?', hoursAfterCreation: 6 },
      { direction: 'inbound', body: 'Elina Lehtonen', hoursAfterCreation: 7 },
      { direction: 'outbound', body: 'Varaa aika...', hoursAfterCreation: 7 },
      { direction: 'outbound', body: 'Miten kokemuksesi sujui? Vastaa 1-5', hoursAfterCreation: 200 },
      { direction: 'inbound', body: '2 Odotusaika oli liian pitkä.', hoursAfterCreation: 210 },
    ],
    costs: [{ description: 'Liitäntävaihto', amount: 40 }],
  },

  // ── Two more COMPLETED for dashboard variety ─────────────────────
  {
    status: 'completed', urgency: 'high', consent_given: true,
    issue_description: 'Pesukoneen sulkuventtiili ei mene kiinni',
    caller_name: 'Antti Ahonen', estimated_value: 380,
    booking_time: new Date(Date.now() - 8 * 86400000).toISOString(),
    satisfaction_score: 5, satisfaction_feedback: 'Erinomaista työtä!',
    notes: null, called_during_after_hours: false,
    dnr_alert_sent: false, call_count: 1, daysAgo: 12,
    messages: [], costs: [{ description: 'Sulkuventtiili + työ', amount: 110 }],
  },
  {
    status: 'completed', urgency: 'low', consent_given: true,
    issue_description: 'Ulkohana ei sulkeudu kunnolla',
    caller_name: 'Hanna Niemi', estimated_value: 150,
    booking_time: new Date(Date.now() - 20 * 86400000).toISOString(),
    satisfaction_score: 3, satisfaction_feedback: null,
    notes: null, called_during_after_hours: false,
    dnr_alert_sent: false, call_count: 1, daysAgo: 25,
    messages: [], costs: [],
  },
];

// ── Main seed function ──────────────────────────────────────────────────

async function seed() {
  console.log('🌱  Starting dev seed...\n');

  // Find the first contractor
  const { data: contractors, error: cErr } = await supabase
    .from('contractors')
    .select('id, business_name')
    .order('created_at', { ascending: true })
    .limit(1);

  if (cErr || !contractors?.length) {
    console.error('❌  No contractor found. Complete onboarding first.');
    process.exit(1);
  }

  const contractor = contractors[0];
  console.log(`📌  Using contractor: ${contractor.business_name} (${contractor.id})\n`);

  // Clear existing dev seed data (leads with test phone numbers)
  const testPhones = FINNISH_PHONES.slice(0, SEED_LEADS.length);
  console.log(`🗑️   Cleaning up ${testPhones.length} test phone numbers...`);

  // Delete messages and costs for existing test leads first
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('id')
    .eq('contractor_id', contractor.id)
    .in('caller_phone', testPhones);

  if (existingLeads?.length) {
    const leadIds = existingLeads.map(l => l.id);
    await supabase.from('messages').delete().in('lead_id', leadIds);
    await supabase.from('job_costs').delete().in('lead_id', leadIds);
    await supabase.from('scheduled_tasks').delete().in('lead_id', leadIds);
    await supabase.from('leads').delete().in('id', leadIds);
    console.log(`   Deleted ${existingLeads.length} existing test leads.\n`);
  }

  // Insert seed leads
  let insertedCount = 0;
  for (let i = 0; i < SEED_LEADS.length; i++) {
    const seed = SEED_LEADS[i];
    const leadId = randomUUID();
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - seed.daysAgo);

    const { error: leadErr } = await supabase.from('leads').insert({
      id: leadId,
      contractor_id: contractor.id,
      caller_phone: FINNISH_PHONES[i],
      caller_name: seed.caller_name,
      issue_description: seed.issue_description,
      urgency: seed.urgency,
      status: seed.status,
      consent_given: seed.consent_given,
      consent_given_at: seed.consent_given ? createdAt.toISOString() : null,
      call_count: seed.call_count,
      estimated_value: seed.estimated_value,
      booking_time: seed.booking_time,
      dnr_alert_sent: seed.dnr_alert_sent,
      dnr_alert_sent_at: seed.dnr_alert_sent ? createdAt.toISOString() : null,
      satisfaction_score: seed.satisfaction_score,
      satisfaction_feedback: seed.satisfaction_feedback,
      notes: seed.notes,
      called_during_after_hours: seed.called_during_after_hours,
      created_at: createdAt.toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (leadErr) {
      console.error(`  ❌ Lead ${i}: ${leadErr.message}`);
      continue;
    }

    // Insert messages
    if (seed.messages.length) {
      const msgs = seed.messages.map(m => ({
        id: randomUUID(),
        lead_id: leadId,
        direction: m.direction,
        body: m.body,
        twilio_message_sid: null,
        sent_at: hoursAgo(seed.daysAgo, m.hoursAfterCreation).toISOString(),
      }));
      await supabase.from('messages').insert(msgs);
    }

    // Insert costs
    if (seed.costs.length) {
      const costs = seed.costs.map(c => ({
        id: randomUUID(),
        lead_id: leadId,
        description: c.description,
        amount: c.amount,
        created_at: createdAt.toISOString(),
      }));
      await supabase.from('job_costs').insert(costs);
    }

    const emoji = {
      missed: '📞', consent_sent: '📤', no_consent: '🚫',
      qualifying_issue: '❓', qualifying_urgency: '⏰', qualifying_name: '👤',
      booking_sent: '📅', booked: '✅', completed: '🏁',
      followed_up: '⭐', dnr_alert: '⚠️',
    }[seed.status] || '📋';

    console.log(
      `  ${emoji} ${(seed.caller_name || FINNISH_PHONES[i]).padEnd(22)} ` +
      `${seed.status.padEnd(20)} ${seed.urgency.padEnd(10)} ` +
      `${seed.messages.length} msgs, ${seed.costs.length} costs`
    );
    insertedCount++;
  }

  console.log(`\n✅  Seeded ${insertedCount} leads with conversations, costs, and ratings.`);
  console.log('   Refresh the app to see them on the dashboard!\n');
}

seed().catch(console.error);
