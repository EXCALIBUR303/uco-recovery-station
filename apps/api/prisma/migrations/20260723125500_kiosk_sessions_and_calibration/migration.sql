
-- CreateEnum
CREATE TYPE "kiosk_session_state" AS ENUM ('awaiting_pair', 'paired', 'processing', 'complete', 'expired');

-- AlterTable
ALTER TABLE "kiosk_sessions" ADD COLUMN     "pair_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "pair_token_hash" TEXT,
ADD COLUMN     "state" "kiosk_session_state" NOT NULL DEFAULT 'awaiting_pair';

-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "cap_contaminated_max" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
ADD COLUMN     "cap_oil_max" DOUBLE PRECISION NOT NULL DEFAULT 6.0,
ADD COLUMN     "cap_oil_min" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
ADD COLUMN     "color_quality_min" DOUBLE PRECISION NOT NULL DEFAULT 60;

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_sessions_pair_token_hash_key" ON "kiosk_sessions"("pair_token_hash");

