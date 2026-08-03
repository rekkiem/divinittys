-- AlterTable
ALTER TABLE "promotions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "shipments" ALTER COLUMN "shippingCost" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "subscribers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "vendor_payouts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "vendors" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
