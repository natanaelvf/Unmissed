-- seed-dev-leads.sql
-- Inserts 16 test leads across every status and urgency level,
-- plus simulated conversations, costs, and ratings.
--
-- HOW TO USE:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--
-- PREREQUISITES:
--   You must have at least one contractor row. The script uses the FIRST
--   contractor found (ordered by created_at).
--
-- To clean up: run seed-dev-clear.sql

-- ── Get contractor ID ──────────────────────────────────────────────────
DO $$
DECLARE
  v_cid uuid;
  v_lid uuid;
  v_now timestamptz := now();
BEGIN
  -- Find the first contractor
  SELECT id INTO v_cid FROM contractors ORDER BY created_at ASC LIMIT 1;
  IF v_cid IS NULL THEN
    RAISE EXCEPTION 'No contractor found. Complete onboarding first.';
  END IF;

  RAISE NOTICE 'Using contractor: %', v_cid;

  -- Clean up any existing test leads (by phone prefix +358 40 1)
  DELETE FROM messages WHERE lead_id IN (
    SELECT id FROM leads WHERE contractor_id = v_cid AND caller_phone LIKE '+358 40 1%'
  );
  DELETE FROM job_costs WHERE lead_id IN (
    SELECT id FROM leads WHERE contractor_id = v_cid AND caller_phone LIKE '+358 40 1%'
  );
  DELETE FROM scheduled_tasks WHERE lead_id IN (
    SELECT id FROM leads WHERE contractor_id = v_cid AND caller_phone LIKE '+358 40 1%'
  );
  DELETE FROM leads WHERE contractor_id = v_cid AND caller_phone LIKE '+358 40 1%';

  -- ── 1. MISSED — brand new, no interaction ────────────────────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1000000', NULL, 'missed', 'unknown',
    false, 1, v_now - interval '2 hours', v_now);

  -- ── 2. MISSED — after hours, 2 calls ─────────────────────────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, call_count, called_during_after_hours, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1111111', NULL, 'missed', 'unknown',
    false, 2, true, v_now - interval '1 hour', v_now);

  -- ── 3. CONSENT_SENT — waiting for reply ──────────────────────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1222222', NULL, 'consent_sent', 'unknown',
    false, 1, v_now - interval '30 minutes', v_now);
  INSERT INTO messages (lead_id, direction, body, sent_at)
  VALUES (v_lid, 'outbound', 'Hei! Yritit juuri soittaa...', v_now - interval '30 minutes');

  -- ── 4. NO_CONSENT — declined ─────────────────────────────────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1333333', NULL, 'no_consent', 'unknown',
    false, 1, v_now - interval '3 days', v_now);
  INSERT INTO messages (lead_id, direction, body, sent_at) VALUES
    (v_lid, 'outbound', 'Hei! Yritit soittaa...', v_now - interval '3 days'),
    (v_lid, 'inbound', 'EI', v_now - interval '3 days' + interval '30 minutes'),
    (v_lid, 'outbound', 'Ei hätää! Emme lähetä sinulle enää viestejä.', v_now - interval '3 days' + interval '31 minutes');

  -- ── 5. QUALIFYING_ISSUE — opted in, asking about issue ───────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, consent_given_at, call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1444444', NULL, 'qualifying_issue', 'unknown',
    true, v_now - interval '1 day', 1, v_now - interval '1 day', v_now);
  INSERT INTO messages (lead_id, direction, body, sent_at) VALUES
    (v_lid, 'outbound', 'Hei! Yritit soittaa...', v_now - interval '1 day'),
    (v_lid, 'inbound', 'KYLLÄ', v_now - interval '1 day' + interval '1 hour'),
    (v_lid, 'outbound', 'Kiitos! Voitko lyhyesti kuvata ongelman?', v_now - interval '1 day' + interval '1 hour');

  -- ── 6. QUALIFYING_URGENCY — issue described, asking urgency ──────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, consent_given_at, issue_description, call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1555555', NULL, 'qualifying_urgency', 'unknown',
    true, v_now - interval '1 day', 'Putkivuoto keittiössä', 1, v_now - interval '1 day', v_now);
  INSERT INTO messages (lead_id, direction, body, sent_at) VALUES
    (v_lid, 'outbound', 'Hei! Yritit soittaa...', v_now - interval '1 day'),
    (v_lid, 'inbound', 'KYLLÄ', v_now - interval '1 day' + interval '30 minutes'),
    (v_lid, 'outbound', 'Voitko kuvata ongelman?', v_now - interval '1 day' + interval '30 minutes'),
    (v_lid, 'inbound', 'Putkivuoto keittiössä', v_now - interval '1 day' + interval '1 hour'),
    (v_lid, 'outbound', 'Kuinka kiireellinen asia on? 1-4', v_now - interval '1 day' + interval '1 hour');

  -- ── 7. QUALIFYING_NAME — urgency set (LOW), asking name ──────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, consent_given_at, issue_description, call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1666666', NULL, 'qualifying_name', 'low',
    true, v_now - interval '2 days', 'Keittiön hana tippuu', 1, v_now - interval '2 days', v_now);
  INSERT INTO messages (lead_id, direction, body, sent_at) VALUES
    (v_lid, 'outbound', 'Hei! Yritit soittaa...', v_now - interval '2 days'),
    (v_lid, 'inbound', 'KYLLÄ', v_now - interval '2 days' + interval '20 minutes'),
    (v_lid, 'outbound', 'Voitko kuvata ongelman?', v_now - interval '2 days' + interval '20 minutes'),
    (v_lid, 'inbound', 'Keittiön hana tippuu', v_now - interval '2 days' + interval '50 minutes'),
    (v_lid, 'outbound', 'Kuinka kiireellinen? 1-4', v_now - interval '2 days' + interval '50 minutes'),
    (v_lid, 'inbound', '1', v_now - interval '2 days' + interval '1 hour 10 minutes'),
    (v_lid, 'outbound', 'Kiitos! Millä nimellä voimme kutsua sinua?', v_now - interval '2 days' + interval '1 hour 10 minutes');

  -- ── 8. BOOKING_SENT — MEDIUM urgency ─────────────────────────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, consent_given_at, issue_description, estimated_value, notes,
    call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1777777', 'Liisa Virtanen', 'booking_sent', 'medium',
    true, v_now - interval '2 days', 'Suihkusekoitin ei toimi', 280,
    'Asiakas vaikutti kiireiseltä, kannattaa soittaa aamulla.',
    1, v_now - interval '2 days', v_now);
  INSERT INTO messages (lead_id, direction, body, sent_at) VALUES
    (v_lid, 'outbound', 'Hei! Yritit soittaa...', v_now - interval '2 days'),
    (v_lid, 'inbound', 'KYLLÄ', v_now - interval '2 days' + interval '12 minutes'),
    (v_lid, 'outbound', 'Voitko kuvata ongelman?', v_now - interval '2 days' + interval '12 minutes'),
    (v_lid, 'inbound', 'Suihkusekoitin ei toimi', v_now - interval '2 days' + interval '30 minutes'),
    (v_lid, 'outbound', 'Kuinka kiireellinen? 1-4', v_now - interval '2 days' + interval '30 minutes'),
    (v_lid, 'inbound', '2', v_now - interval '2 days' + interval '42 minutes'),
    (v_lid, 'outbound', 'Millä nimellä voimme kutsua sinua?', v_now - interval '2 days' + interval '42 minutes'),
    (v_lid, 'inbound', 'Liisa Virtanen', v_now - interval '2 days' + interval '1 hour'),
    (v_lid, 'outbound', 'Kiitos! Varaa aika seuraavan 2-3 päivän sisällä...', v_now - interval '2 days' + interval '1 hour');

  -- ── 9. BOOKED — HIGH urgency ─────────────────────────────────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, consent_given_at, issue_description, estimated_value, notes,
    booking_time, call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1888888', 'Juha Nieminen', 'booked', 'high',
    true, v_now - interval '3 days', 'Viemäri tukkeutunut, vesi ei laske', 450,
    'Vanha kiinteistö, mahdollisesti kupariputket.',
    v_now + interval '2 days', 1, v_now - interval '3 days', v_now);
  INSERT INTO messages (lead_id, direction, body, sent_at) VALUES
    (v_lid, 'outbound', 'Hei! Yritit soittaa...', v_now - interval '3 days'),
    (v_lid, 'inbound', 'KYLLÄ', v_now - interval '3 days' + interval '6 minutes'),
    (v_lid, 'outbound', 'Voitko kuvata ongelman?', v_now - interval '3 days' + interval '6 minutes'),
    (v_lid, 'inbound', 'Viemäri tukkeutunut', v_now - interval '3 days' + interval '18 minutes'),
    (v_lid, 'outbound', 'Kuinka kiireellinen? 1-4', v_now - interval '3 days' + interval '18 minutes'),
    (v_lid, 'inbound', '3', v_now - interval '3 days' + interval '24 minutes'),
    (v_lid, 'outbound', 'Millä nimellä?', v_now - interval '3 days' + interval '24 minutes'),
    (v_lid, 'inbound', 'Juha Nieminen', v_now - interval '3 days' + interval '30 minutes'),
    (v_lid, 'outbound', '⚡ Varaa ensimmäinen vapaa aika...', v_now - interval '3 days' + interval '30 minutes');

  -- ── 10. COMPLETED — EMERGENCY, with costs and 5★ rating ──────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, consent_given_at, issue_description, estimated_value, notes,
    booking_time, satisfaction_score, satisfaction_feedback,
    called_during_after_hours, call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1999999', 'Timo Hämäläinen', 'completed', 'emergency',
    true, v_now - interval '7 days', 'Kylmävesiputki jäätynyt autotallissa, vesi suihkuaa!', 850,
    'Avaimet naapurilla, soita ensin 040-1234567.',
    v_now - interval '5 days', 5, 'Tosi nopeaa palvelua, kiitos!',
    true, 3, v_now - interval '7 days', v_now);
  INSERT INTO messages (lead_id, direction, body, sent_at) VALUES
    (v_lid, 'outbound', 'Hei! Yritit soittaa...', v_now - interval '7 days'),
    (v_lid, 'inbound', 'KYLLÄ', v_now - interval '7 days' + interval '3 minutes'),
    (v_lid, 'outbound', 'Voitko kuvata ongelman?', v_now - interval '7 days' + interval '3 minutes'),
    (v_lid, 'inbound', 'Vesiputki jäätynyt, vesi suihkuaa!', v_now - interval '7 days' + interval '6 minutes'),
    (v_lid, 'outbound', 'Kuinka kiireellinen? 1-4', v_now - interval '7 days' + interval '6 minutes'),
    (v_lid, 'inbound', '4', v_now - interval '7 days' + interval '7 minutes'),
    (v_lid, 'outbound', '🚨 Soitamme sinulle heti takaisin!', v_now - interval '7 days' + interval '7 minutes');
  INSERT INTO job_costs (lead_id, description, amount, created_at) VALUES
    (v_lid, 'Hätätyö, iltalisä', 120, v_now - interval '5 days'),
    (v_lid, 'Putken vaihto (materiaali)', 85, v_now - interval '5 days'),
    (v_lid, 'Työ 2h', 180, v_now - interval '5 days');

  -- ── 11. COMPLETED — LOW, cheap job, 4★ ───────────────────────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, consent_given_at, issue_description, estimated_value,
    booking_time, satisfaction_score, call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1100000', 'Kaisa Koskinen', 'completed', 'low',
    true, v_now - interval '14 days', 'Lavuaarin pohjaventtiili vuotaa', 120,
    v_now - interval '10 days', 4, 1, v_now - interval '14 days', v_now);
  INSERT INTO job_costs (lead_id, description, amount, created_at) VALUES
    (v_lid, 'Pohjaventtiili + työ', 65, v_now - interval '10 days');

  -- ── 12. FOLLOWED_UP — waiting for satisfaction reply ──────────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, consent_given_at, issue_description, estimated_value, notes,
    booking_time, call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1200000', 'Sanna Laine', 'followed_up', 'medium',
    true, v_now - interval '8 days', 'Patterin termostaatti rikki', 350,
    'Asunto 3. kerroksessa, ei hissiä. Varaa aikaa.',
    v_now - interval '3 days', 1, v_now - interval '8 days', v_now);
  INSERT INTO messages (lead_id, direction, body, sent_at) VALUES
    (v_lid, 'outbound', 'Hei! Yritit soittaa...', v_now - interval '8 days'),
    (v_lid, 'inbound', 'KYLLÄ', v_now - interval '8 days' + interval '1 hour'),
    (v_lid, 'outbound', 'Voitko kuvata ongelman?', v_now - interval '8 days' + interval '1 hour'),
    (v_lid, 'inbound', 'Patterin termostaatti rikki', v_now - interval '8 days' + interval '2 hours'),
    (v_lid, 'outbound', 'Miten kokemuksesi sujui? Vastaa 1-5', v_now - interval '3 days');
  INSERT INTO job_costs (lead_id, description, amount, created_at) VALUES
    (v_lid, 'Termostaatti', 45, v_now - interval '4 days'),
    (v_lid, 'Asennustyö', 90, v_now - interval '4 days');

  -- ── 13. DNR_ALERT — do not respond ───────────────────────────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, consent_given_at, issue_description, estimated_value, notes,
    dnr_alert_sent, dnr_alert_sent_at, call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1300000', 'Markku Salminen', 'dnr_alert', 'high',
    true, v_now - interval '5 days', 'Lämminvesivaraaja vuotaa pohjasta', 600,
    'Asiakas ei vastaa puheluihin. Lähetetty DNR-ilmoitus.',
    true, v_now - interval '3 days', 4, v_now - interval '5 days', v_now);

  -- ── 14. COMPLETED — MEDIUM, 2★ (low satisfaction) ────────────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, consent_given_at, issue_description, estimated_value,
    booking_time, satisfaction_score, satisfaction_feedback,
    call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1400000', 'Elina Lehtonen', 'completed', 'medium',
    true, v_now - interval '15 days', 'Tiskikoneen liitäntä vuotaa', 200,
    v_now - interval '12 days', 2, 'Odotusaika oli liian pitkä.',
    1, v_now - interval '15 days', v_now);
  INSERT INTO job_costs (lead_id, description, amount, created_at) VALUES
    (v_lid, 'Liitäntävaihto', 40, v_now - interval '12 days');

  -- ── 15. COMPLETED — HIGH, 5★ ────────────────────────────────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, consent_given_at, issue_description, estimated_value,
    booking_time, satisfaction_score, satisfaction_feedback,
    call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1500000', 'Antti Ahonen', 'completed', 'high',
    true, v_now - interval '12 days', 'Pesukoneen sulkuventtiili ei mene kiinni', 380,
    v_now - interval '8 days', 5, 'Erinomaista työtä!',
    1, v_now - interval '12 days', v_now);
  INSERT INTO job_costs (lead_id, description, amount, created_at) VALUES
    (v_lid, 'Sulkuventtiili + työ', 110, v_now - interval '8 days');

  -- ── 16. COMPLETED — LOW, 3★ ─────────────────────────────────────────
  v_lid := gen_random_uuid();
  INSERT INTO leads (id, contractor_id, caller_phone, caller_name, status, urgency,
    consent_given, consent_given_at, issue_description, estimated_value,
    booking_time, satisfaction_score, call_count, created_at, updated_at)
  VALUES (v_lid, v_cid, '+358 40 1600000', 'Hanna Niemi', 'completed', 'low',
    true, v_now - interval '25 days', 'Ulkohana ei sulkeudu kunnolla', 150,
    v_now - interval '20 days', 3, 1, v_now - interval '25 days', v_now);

  RAISE NOTICE 'Seeded 16 test leads with conversations, costs, and ratings!';
END $$;
