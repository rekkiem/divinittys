/*
  Warnings:

  - A unique constraint covering the columns `[productId,name]` on the table `product_attributes` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `product_attributes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "product_attributes" ADD COLUMN     "source" TEXT DEFAULT 'manual',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "descriptionMl" TEXT,
ADD COLUMN     "lastMlSyncAt" TIMESTAMP(3),
ADD COLUMN     "mlSyncStatus" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "image" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "product_attributes_productId_name_key" ON "product_attributes"("productId", "name");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
