
-- AlterTable
ALTER TABLE "machines" ADD COLUMN     "bucket_capacity_l" DECIMAL(6,1) NOT NULL DEFAULT 20,
ADD COLUMN     "drum_capacity_kg" DECIMAL(6,1) NOT NULL DEFAULT 60;

