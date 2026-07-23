-- Proves the database refuses to store states that DESIGN.md forbids.
-- Runs entirely inside a transaction that is rolled back, so it never
-- leaves data behind.  Run with:  npm run db:verify -w @uco/api

BEGIN;

DO $$
DECLARE
  v_dep    uuid;
  v_mach   uuid;
  v_sess   uuid;
  v_passed int := 0;
  v_failed int := 0;
BEGIN
  -- fixtures
  INSERT INTO depositors (phone, upi_id)
    VALUES ('+919999999999', 'invariant-test@upi') RETURNING id INTO v_dep;
  SELECT id INTO v_mach FROM machines WHERE serial_no = 'UCO-0001';
  INSERT INTO kiosk_sessions (machine_id, depositor_id)
    VALUES (v_mach, v_dep) RETURNING id INTO v_sess;

  ---------------------------------------------------------------- deposits
  BEGIN
    INSERT INTO deposits (session_id, machine_id, depositor_id, outcome,
                          rejection_reason, is_offence, weight_delta_g, sensor_readings)
    VALUES (v_sess, v_mach, v_dep, 'ignored', 'below_threshold', true, 50, '{}');
    RAISE NOTICE 'FAIL  a sub-threshold pour was allowed to become an offence';
    v_failed := v_failed + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'pass  sub-threshold pour cannot be an offence';
    v_passed := v_passed + 1;
  END;

  BEGIN
    INSERT INTO deposits (session_id, machine_id, depositor_id, outcome,
                          weight_delta_g, sensor_readings)
    VALUES (v_sess, v_mach, v_dep, 'accepted', 900, '{}');
    RAISE NOTICE 'FAIL  accepted deposit stored without an amount';
    v_failed := v_failed + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'pass  accepted deposit requires an amount';
    v_passed := v_passed + 1;
  END;

  BEGIN
    INSERT INTO deposits (session_id, machine_id, depositor_id, outcome,
                          is_offence, weight_delta_g, sensor_readings)
    VALUES (v_sess, v_mach, v_dep, 'rejected', true, 900, '{}');
    RAISE NOTICE 'FAIL  rejection stored without a reason';
    v_failed := v_failed + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'pass  rejection requires a reason';
    v_passed := v_passed + 1;
  END;

  BEGIN
    INSERT INTO deposits (session_id, machine_id, depositor_id, outcome,
                          rejection_reason, is_offence, weight_delta_g, sensor_readings)
    VALUES (v_sess, v_mach, v_dep, 'rejected', 'below_threshold', true, 10, '{}');
    RAISE NOTICE 'FAIL  below_threshold was allowed to be a rejection';
    v_failed := v_failed + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'pass  below_threshold can only ever be ignored';
    v_passed := v_passed + 1;
  END;

  ----------------------------------------------------------------- wallets
  BEGIN
    INSERT INTO wallets (owner_type, owner_id) VALUES ('company', NULL);
    RAISE NOTICE 'FAIL  a second company wallet was created';
    v_failed := v_failed + 1;
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'pass  only one company wallet can exist';
    v_passed := v_passed + 1;
  END;

  BEGIN
    INSERT INTO wallets (owner_type, owner_id, balance_paise, held_paise)
    VALUES ('renter', gen_random_uuid(), 100, 500);
    RAISE NOTICE 'FAIL  held more than the wallet balance';
    v_failed := v_failed + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'pass  cannot hold more than the balance';
    v_passed := v_passed + 1;
  END;

  BEGIN
    INSERT INTO wallets (owner_type, owner_id, balance_paise)
    VALUES ('renter', gen_random_uuid(), -1);
    RAISE NOTICE 'FAIL  negative wallet balance accepted';
    v_failed := v_failed + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'pass  wallet balance cannot go negative';
    v_passed := v_passed + 1;
  END;

  ---------------------------------------------------------------- machines
  BEGIN
    INSERT INTO machines (serial_no, ownership, renter_id, rate_per_kg_paise)
    VALUES ('UCO-TEST-X', 'rented', NULL, 3500);
    RAISE NOTICE 'FAIL  rented machine stored with no renter';
    v_failed := v_failed + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'pass  a rented machine must have a renter';
    v_passed := v_passed + 1;
  END;

  ------------------------------------------------------- platform_settings
  BEGIN
    INSERT INTO platform_settings (id, updated_at) VALUES (false, now());
    RAISE NOTICE 'FAIL  a second settings row was created';
    v_failed := v_failed + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'pass  platform_settings stays a single row';
    v_passed := v_passed + 1;
  END;

  ------------------------------------------- positive control (must insert)
  BEGIN
    INSERT INTO deposits (session_id, machine_id, depositor_id, outcome,
                          weight_delta_g, rate_per_kg_paise, amount_paise, sensor_readings)
    VALUES (v_sess, v_mach, v_dep, 'accepted', 2400, 3500, 8400,
            '{"capacitance": 42.1, "color": 118, "weight_g": 2400}');
    RAISE NOTICE 'pass  a valid accepted deposit still inserts cleanly';
    v_passed := v_passed + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL  valid deposit was rejected: %', SQLERRM;
    v_failed := v_failed + 1;
  END;

  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'invariants: % passed, % failed', v_passed, v_failed;
  IF v_failed > 0 THEN
    RAISE EXCEPTION '% invariant check(s) failed', v_failed;
  END IF;
END $$;

ROLLBACK;
