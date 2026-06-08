-- seed-dev-clear.sql
-- Removes all test leads created by seed-dev-leads.sql.
-- Test leads are identified by phone numbers starting with +358 40 1.
--
-- HOW TO USE:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"

DO $$
DECLARE
  v_cid uuid;
  v_count int;
BEGIN
  SELECT id INTO v_cid FROM contractors ORDER BY created_at ASC LIMIT 1;
  IF v_cid IS NULL THEN
    RAISE NOTICE 'No contractor found. Nothing to clean.';
    RETURN;
  END IF;

  -- Count before deleting
  SELECT count(*) INTO v_count
  FROM leads WHERE contractor_id = v_cid AND caller_phone LIKE '+358 40 1%';

  -- Delete in dependency order: messages → costs → tasks → leads
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

  RAISE NOTICE 'Cleared % test leads and their related data.', v_count;
END $$;
