-- AlterTable
ALTER TABLE "machines" ALTER COLUMN "bucket_capacity_l" SET DEFAULT 200,
ALTER COLUMN "drum_capacity_kg" SET DEFAULT 200;

-- Existing machines were provisioned under the old 60kg/20L defaults; bring
-- them up to the new 200/200 capacity too, not just new rows going forward.
UPDATE "machines" SET "drum_capacity_kg" = 200, "bucket_capacity_l" = 200;
