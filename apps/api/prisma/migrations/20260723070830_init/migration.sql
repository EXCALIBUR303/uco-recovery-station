-- CreateEnum
CREATE TYPE "dashboard_role" AS ENUM ('admin', 'renter');

-- CreateEnum
CREATE TYPE "depositor_status" AS ENUM ('active', 'blacklisted');

-- CreateEnum
CREATE TYPE "machine_ownership" AS ENUM ('company', 'rented');

-- CreateEnum
CREATE TYPE "machine_effective_status" AS ENUM ('in_service', 'drum_full', 'reject_full', 'balance_zero', 'offline');

-- CreateEnum
CREATE TYPE "deposit_outcome" AS ENUM ('accepted', 'rejected', 'ignored');

-- CreateEnum
CREATE TYPE "rejection_reason" AS ENUM ('not_oil', 'water_contaminated', 'low_quality', 'below_threshold');

-- CreateEnum
CREATE TYPE "wallet_owner_type" AS ENUM ('renter', 'company');

-- CreateEnum
CREATE TYPE "ledger_reason" AS ENUM ('topup', 'payout_hold', 'payout_capture', 'payout_release', 'rental_fee', 'adjustment', 'reversal');

-- CreateEnum
CREATE TYPE "topup_status" AS ENUM ('created', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "payout_status" AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'reversed');

-- CreateEnum
CREATE TYPE "agreement_status" AS ENUM ('active', 'suspended', 'terminated');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('due', 'paid', 'overdue', 'waived');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('drum_full', 'reject_full', 'balance_zero', 'idle_7day', 'offline', 'blacklist', 'excessive_ignores', 'rental_overdue', 'payout_failed');

-- CreateTable
CREATE TABLE "dashboard_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" "dashboard_role" NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dashboard_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depositors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" TEXT NOT NULL,
    "upi_id" TEXT NOT NULL,
    "upi_verified_at" TIMESTAMPTZ(6),
    "status" "depositor_status" NOT NULL DEFAULT 'active',
    "offence_count" INTEGER NOT NULL DEFAULT 0,
    "ignored_count" INTEGER NOT NULL DEFAULT 0,
    "blacklisted_at" TIMESTAMPTZ(6),
    "blacklist_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "depositors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklisted_upis" (
    "upi_id" TEXT NOT NULL,
    "depositor_id" UUID,
    "reason" TEXT,
    "blacklisted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifted_at" TIMESTAMPTZ(6),
    "lifted_by" UUID,

    CONSTRAINT "blacklisted_upis_pkey" PRIMARY KEY ("upi_id")
);

-- CreateTable
CREATE TABLE "depositor_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "depositor_id" UUID NOT NULL,
    "device_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depositor_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_status_events" (
    "id" BIGSERIAL NOT NULL,
    "depositor_id" UUID NOT NULL,
    "from_status" "depositor_status",
    "to_status" "depositor_status" NOT NULL,
    "reason" TEXT,
    "triggered_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "serial_no" TEXT NOT NULL,
    "label" TEXT,
    "location_text" TEXT,
    "geo_lat" DECIMAL(9,6),
    "geo_lng" DECIMAL(9,6),
    "ownership" "machine_ownership" NOT NULL DEFAULT 'company',
    "renter_id" UUID,
    "funding_wallet_id" UUID,
    "rate_per_kg_paise" BIGINT NOT NULL,
    "min_weight_delta_g" INTEGER,
    "drum_fill_pct" SMALLINT,
    "reject_fill_pct" SMALLINT,
    "effective_status" "machine_effective_status" NOT NULL DEFAULT 'offline',
    "is_idle" BOOLEAN NOT NULL DEFAULT false,
    "last_telemetry_at" TIMESTAMPTZ(6),
    "last_activity_at" TIMESTAMPTZ(6),
    "firmware_version" TEXT,
    "total_weight_g" BIGINT NOT NULL DEFAULT 0,
    "total_paid_out_paise" BIGINT NOT NULL DEFAULT 0,
    "deployed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry_snapshots" (
    "machine_id" UUID NOT NULL,
    "ts" TIMESTAMPTZ(6) NOT NULL,
    "drum_fill_pct" SMALLINT,
    "reject_fill_pct" SMALLINT,
    "online" BOOLEAN NOT NULL,
    "raw" JSONB,

    CONSTRAINT "telemetry_snapshots_pkey" PRIMARY KEY ("machine_id","ts")
);

-- CreateTable
CREATE TABLE "machine_status_events" (
    "id" BIGSERIAL NOT NULL,
    "machine_id" UUID NOT NULL,
    "from_status" "machine_effective_status",
    "to_status" "machine_effective_status" NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" BOOLEAN NOT NULL DEFAULT true,
    "default_min_weight_delta_g" INTEGER NOT NULL DEFAULT 100,
    "blacklist_threshold" INTEGER NOT NULL DEFAULT 3,
    "blacklist_mode" TEXT NOT NULL DEFAULT 'permanent',
    "blacklist_auto_reset_days" INTEGER,
    "idle_alert_days" INTEGER NOT NULL DEFAULT 7,
    "activity_counts_rejections" BOOLEAN NOT NULL DEFAULT true,
    "offline_after_seconds" INTEGER NOT NULL DEFAULT 300,
    "rental_grace_days" INTEGER NOT NULL DEFAULT 7,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kiosk_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "machine_id" UUID NOT NULL,
    "depositor_id" UUID,
    "language" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paired_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "kiosk_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "depositor_id" UUID NOT NULL,
    "outcome" "deposit_outcome" NOT NULL,
    "rejection_reason" "rejection_reason",
    "is_offence" BOOLEAN NOT NULL DEFAULT false,
    "weight_delta_g" INTEGER NOT NULL,
    "rate_per_kg_paise" BIGINT,
    "amount_paise" BIGINT,
    "sensor_readings" JSONB NOT NULL,
    "funded_wallet_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_type" "wallet_owner_type" NOT NULL,
    "owner_id" UUID,
    "balance_paise" BIGINT NOT NULL DEFAULT 0,
    "held_paise" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_journal" (
    "id" BIGSERIAL NOT NULL,
    "reason" "ledger_reason" NOT NULL,
    "ref_type" TEXT,
    "ref_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_postings" (
    "id" BIGSERIAL NOT NULL,
    "journal_id" BIGINT NOT NULL,
    "wallet_id" UUID NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_topups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "status" "topup_status" NOT NULL DEFAULT 'created',
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "journal_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wallet_topups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deposit_id" UUID NOT NULL,
    "depositor_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "upi_id" TEXT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "status" "payout_status" NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT NOT NULL,
    "razorpayx_payout_id" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_agreements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "renter_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "monthly_fee_paise" BIGINT NOT NULL,
    "status" "agreement_status" NOT NULL DEFAULT 'active',
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "next_bill_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agreement_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'due',
    "due_date" DATE NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "notification_type" NOT NULL,
    "machine_id" UUID,
    "depositor_id" UUID,
    "target_role" "dashboard_role" NOT NULL,
    "target_user" UUID,
    "payload" JSONB,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_users_email_key" ON "dashboard_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "depositors_phone_key" ON "depositors"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "depositor_devices_device_token_hash_key" ON "depositor_devices"("device_token_hash");

-- CreateIndex
CREATE INDEX "depositor_devices_depositor_id_idx" ON "depositor_devices"("depositor_id");

-- CreateIndex
CREATE INDEX "account_status_events_depositor_id_created_at_idx" ON "account_status_events"("depositor_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "machines_serial_no_key" ON "machines"("serial_no");

-- CreateIndex
CREATE INDEX "machines_effective_status_idx" ON "machines"("effective_status");

-- CreateIndex
CREATE INDEX "machines_renter_id_idx" ON "machines"("renter_id");

-- CreateIndex
CREATE INDEX "machine_status_events_machine_id_created_at_idx" ON "machine_status_events"("machine_id", "created_at");

-- CreateIndex
CREATE INDEX "kiosk_sessions_machine_id_started_at_idx" ON "kiosk_sessions"("machine_id", "started_at");

-- CreateIndex
CREATE INDEX "deposits_depositor_id_created_at_idx" ON "deposits"("depositor_id", "created_at");

-- CreateIndex
CREATE INDEX "deposits_machine_id_created_at_idx" ON "deposits"("machine_id", "created_at");

-- CreateIndex
CREATE INDEX "deposits_outcome_created_at_idx" ON "deposits"("outcome", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_owner_type_owner_id_key" ON "wallets"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "ledger_postings_wallet_id_id_idx" ON "ledger_postings"("wallet_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_topups_razorpay_order_id_key" ON "wallet_topups"("razorpay_order_id");

-- CreateIndex
CREATE INDEX "wallet_topups_wallet_id_created_at_idx" ON "wallet_topups"("wallet_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_deposit_id_key" ON "payouts"("deposit_id");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_idempotency_key_key" ON "payouts"("idempotency_key");

-- CreateIndex
CREATE INDEX "payouts_status_created_at_idx" ON "payouts"("status", "created_at");

-- CreateIndex
CREATE INDEX "rental_agreements_renter_id_idx" ON "rental_agreements"("renter_id");

-- CreateIndex
CREATE INDEX "rental_invoices_agreement_id_period_start_idx" ON "rental_invoices"("agreement_id", "period_start");

-- CreateIndex
CREATE INDEX "notifications_target_role_resolved_at_created_at_idx" ON "notifications"("target_role", "resolved_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_machine_id_type_idx" ON "notifications"("machine_id", "type");

-- AddForeignKey
ALTER TABLE "blacklisted_upis" ADD CONSTRAINT "blacklisted_upis_depositor_id_fkey" FOREIGN KEY ("depositor_id") REFERENCES "depositors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklisted_upis" ADD CONSTRAINT "blacklisted_upis_lifted_by_fkey" FOREIGN KEY ("lifted_by") REFERENCES "dashboard_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depositor_devices" ADD CONSTRAINT "depositor_devices_depositor_id_fkey" FOREIGN KEY ("depositor_id") REFERENCES "depositors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_status_events" ADD CONSTRAINT "account_status_events_depositor_id_fkey" FOREIGN KEY ("depositor_id") REFERENCES "depositors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_renter_id_fkey" FOREIGN KEY ("renter_id") REFERENCES "dashboard_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_funding_wallet_id_fkey" FOREIGN KEY ("funding_wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_snapshots" ADD CONSTRAINT "telemetry_snapshots_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_status_events" ADD CONSTRAINT "machine_status_events_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_sessions" ADD CONSTRAINT "kiosk_sessions_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_sessions" ADD CONSTRAINT "kiosk_sessions_depositor_id_fkey" FOREIGN KEY ("depositor_id") REFERENCES "depositors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "kiosk_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_depositor_id_fkey" FOREIGN KEY ("depositor_id") REFERENCES "depositors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_funded_wallet_id_fkey" FOREIGN KEY ("funded_wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "ledger_journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "ledger_journal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "deposits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_depositor_id_fkey" FOREIGN KEY ("depositor_id") REFERENCES "depositors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_renter_id_fkey" FOREIGN KEY ("renter_id") REFERENCES "dashboard_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_invoices" ADD CONSTRAINT "rental_invoices_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "rental_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_depositor_id_fkey" FOREIGN KEY ("depositor_id") REFERENCES "depositors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_target_user_fkey" FOREIGN KEY ("target_user") REFERENCES "dashboard_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
