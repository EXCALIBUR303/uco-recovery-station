
-- AlterTable
ALTER TABLE "dashboard_users" ADD COLUMN     "approved_at" TIMESTAMPTZ(6),
ADD COLUMN     "approved_by" UUID,
ADD COLUMN     "brand_accent" TEXT,
ADD COLUMN     "brand_name" TEXT;

-- AlterTable
ALTER TABLE "machines" ADD COLUMN     "device_secret_hash" TEXT;

-- Backfill: accounts that existed before approval was introduced are already
-- trusted (they were provisioned by hand), so grandfather them in rather than
-- locking out working logins. Only new self-sign-ups start unapproved.
UPDATE "dashboard_users" SET "approved_at" = "created_at" WHERE "approved_at" IS NULL;

