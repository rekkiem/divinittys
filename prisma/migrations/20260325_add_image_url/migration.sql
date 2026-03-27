-- Add imageUrl column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
