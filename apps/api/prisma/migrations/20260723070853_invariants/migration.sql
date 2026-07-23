-- Invariants from DESIGN.md that the Prisma schema language cannot express.
-- These are enforced by the database so no application bug can violate them.

-- ---------------------------------------------------------------- machines
-- A rented machine must have a renter.
ALTER TABLE "machines"
  ADD CONSTRAINT "rented_has_renter"
  CHECK (ownership = 'company' OR renter_id IS NOT NULL);

-- Fill levels are percentages.
ALTER TABLE "machines"
  ADD CONSTRAINT "fill_pct_range"
  CHECK (
    (drum_fill_pct   IS NULL OR drum_fill_pct   BETWEEN 0 AND 100) AND
    (reject_fill_pct IS NULL OR reject_fill_pct BETWEEN 0 AND 100)
  );

ALTER TABLE "machines"
  ADD CONSTRAINT "rate_positive"
  CHECK (rate_per_kg_paise > 0);

-- ---------------------------------------------------------------- deposits
-- An accepted deposit must carry an amount.
ALTER TABLE "deposits"
  ADD CONSTRAINT "accepted_has_amount"
  CHECK (outcome <> 'accepted' OR amount_paise IS NOT NULL);

-- Anything not accepted must say why.
ALTER TABLE "deposits"
  ADD CONSTRAINT "rejected_has_reason"
  CHECK (outcome = 'accepted' OR rejection_reason IS NOT NULL);

-- An offence is only ever an accountable rejection. In particular a
-- sub-threshold pour (outcome 'ignored') can never become an offence --
-- spec section 5: "not logged as an offence".
ALTER TABLE "deposits"
  ADD CONSTRAINT "offence_only_when_rejected"
  CHECK (NOT is_offence OR outcome = 'rejected');

-- 'ignored' exists for exactly one reason: the weight gate.
ALTER TABLE "deposits"
  ADD CONSTRAINT "ignored_is_below_threshold"
  CHECK (outcome <> 'ignored' OR rejection_reason = 'below_threshold');

-- ...and conversely, below_threshold must never be reported as a rejection,
-- since that would penalise an accidental drip.
ALTER TABLE "deposits"
  ADD CONSTRAINT "below_threshold_is_ignored"
  CHECK (rejection_reason <> 'below_threshold' OR outcome = 'ignored');

ALTER TABLE "deposits"
  ADD CONSTRAINT "weight_non_negative"
  CHECK (weight_delta_g >= 0);

ALTER TABLE "deposits"
  ADD CONSTRAINT "amount_non_negative"
  CHECK (amount_paise IS NULL OR amount_paise >= 0);

-- ----------------------------------------------------------------- wallets
-- Money never goes negative, and you cannot hold more than you have.
ALTER TABLE "wallets"
  ADD CONSTRAINT "balance_non_negative"
  CHECK (balance_paise >= 0);

ALTER TABLE "wallets"
  ADD CONSTRAINT "held_non_negative"
  CHECK (held_paise >= 0);

ALTER TABLE "wallets"
  ADD CONSTRAINT "held_within_balance"
  CHECK (held_paise <= balance_paise);

-- A renter wallet must name its owner.
ALTER TABLE "wallets"
  ADD CONSTRAINT "renter_wallet_has_owner"
  CHECK (owner_type = 'company' OR owner_id IS NOT NULL);

-- The (owner_type, owner_id) UNIQUE from the schema does NOT stop multiple
-- company wallets, because Postgres treats NULLs as distinct. This partial
-- index enforces exactly one company wallet.
CREATE UNIQUE INDEX "one_company_wallet"
  ON "wallets" (owner_type)
  WHERE owner_id IS NULL;

-- ----------------------------------------------------------------- payouts
ALTER TABLE "payouts"
  ADD CONSTRAINT "payout_amount_positive"
  CHECK (amount_paise > 0);

-- ------------------------------------------------------- platform_settings
-- Single-row table.
ALTER TABLE "platform_settings"
  ADD CONSTRAINT "platform_settings_singleton"
  CHECK (id);

ALTER TABLE "platform_settings"
  ADD CONSTRAINT "blacklist_mode_valid"
  CHECK (blacklist_mode IN ('permanent', 'appealable', 'auto_reset'));

ALTER TABLE "platform_settings"
  ADD CONSTRAINT "thresholds_sane"
  CHECK (
    default_min_weight_delta_g >= 0 AND
    blacklist_threshold        >= 1 AND
    idle_alert_days            >= 1 AND
    offline_after_seconds      >= 30
  );

-- ------------------------------------------------------------ rental terms
ALTER TABLE "rental_agreements"
  ADD CONSTRAINT "rental_period_ordered"
  CHECK (end_date IS NULL OR end_date >= start_date);

ALTER TABLE "rental_invoices"
  ADD CONSTRAINT "invoice_period_ordered"
  CHECK (period_end >= period_start);
