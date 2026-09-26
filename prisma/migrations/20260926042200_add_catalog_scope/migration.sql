-- CreateEnum
CREATE TYPE "CatalogScope" AS ENUM ('BEAUTY', 'SECONDARY');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "catalogScope" "CatalogScope" NOT NULL DEFAULT 'BEAUTY';

-- CreateIndex
CREATE INDEX "products_catalogScope_idx" ON "products"("catalogScope");

-- CreateIndex
CREATE INDEX "products_isActive_catalogScope_idx" ON "products"("isActive", "catalogScope");
