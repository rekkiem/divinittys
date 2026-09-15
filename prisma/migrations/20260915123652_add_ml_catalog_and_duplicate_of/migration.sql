-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "mlCatalogProductId" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "duplicateOfId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_mlCatalogProductId_idx" ON "products"("mlCatalogProductId");
CREATE INDEX IF NOT EXISTS "products_duplicateOfId_idx" ON "products"("duplicateOfId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "products"
    ADD CONSTRAINT "products_duplicateOfId_fkey"
    FOREIGN KEY ("duplicateOfId") REFERENCES "products"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
