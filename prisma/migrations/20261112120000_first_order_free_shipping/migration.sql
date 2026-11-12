-- Additive only: column + index + normalize existing guest emails.
-- No DROP / DELETE.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "firstOrderFreeShipping" BOOLEAN NOT NULL DEFAULT false;

-- Normalize existing guest emails (lowercase + trim) for exact-match lookups
UPDATE "orders"
SET "guestEmail" = lower(trim("guestEmail"))
WHERE "guestEmail" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "orders_guestEmail_idx" ON "orders"("guestEmail");

-- Optional helper index for eligibility scans by flag + status
CREATE INDEX IF NOT EXISTS "orders_firstOrderFreeShipping_paymentStatus_idx"
  ON "orders"("firstOrderFreeShipping", "paymentStatus")
  WHERE "firstOrderFreeShipping" = true;
