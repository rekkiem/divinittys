-- AlterTable
ALTER TABLE "products" ADD COLUMN     "ratingAverage" DOUBLE PRECISION,
ADD COLUMN     "ratingCount" INTEGER,
ADD COLUMN     "ratingLevelsJson" JSONB;
