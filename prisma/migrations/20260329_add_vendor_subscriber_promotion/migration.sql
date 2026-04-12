-- Add vendorId to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;

-- Create vendors table
CREATE TABLE IF NOT EXISTS "vendors" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId"      TEXT NOT NULL,
  "shopName"    TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "description" TEXT,
  "logo"        TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "commission"  DECIMAL(4,2) NOT NULL DEFAULT 0.15,
  "bankAccount" JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_userId_key" ON "vendors"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_slug_key" ON "vendors"("slug");

-- Create vendor_payouts table
CREATE TABLE IF NOT EXISTS "vendor_payouts" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
  "vendorId"  TEXT NOT NULL,
  "amount"    DECIMAL(10,2) NOT NULL,
  "currency"  TEXT NOT NULL DEFAULT 'CLP',
  "status"    TEXT NOT NULL DEFAULT 'PENDING',
  "reference" TEXT,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt"    TIMESTAMP(3),
  CONSTRAINT "vendor_payouts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "vendor_payouts_vendorId_idx" ON "vendor_payouts"("vendorId");

-- Create subscribers table
CREATE TABLE IF NOT EXISTS "subscribers" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
  "email"     TEXT NOT NULL,
  "name"      TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "source"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "subscribers_email_key" ON "subscribers"("email");

-- Create promotions table
CREATE TABLE IF NOT EXISTS "promotions" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "type"        TEXT NOT NULL,
  "imageUrl"    TEXT,
  "linkUrl"     TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "startsAt"    TIMESTAMP(3),
  "endsAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- Add vendorId index and FK on products
CREATE INDEX IF NOT EXISTS "products_vendorId_idx" ON "products"("vendorId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_vendorId_fkey'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add FK on vendor_payouts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendor_payouts_vendorId_fkey'
  ) THEN
    ALTER TABLE "vendor_payouts"
      ADD CONSTRAINT "vendor_payouts_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Add FK from vendors to users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendors_userId_fkey'
  ) THEN
    ALTER TABLE "vendors"
      ADD CONSTRAINT "vendors_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
