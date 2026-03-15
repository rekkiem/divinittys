export const revalidate = 300;

import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import HeroSection from '@/components/shop/HeroSection';
import FeaturedCategories from '@/components/shop/FeaturedCategories';
import FeaturedProducts from '@/components/shop/FeaturedProducts';
import BeautyAssistantBanner from '@/components/ai/BeautyAssistantBanner';
import HairDiagnosisBanner from '@/components/ai/HairDiagnosisBanner';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import OffersBanner from '@/components/shop/OffersBanner';
import BrandsCarousel from '@/components/shop/BrandsCarousel';

async function getHomeData() {
  const [featuredProducts, categories, brands, onSaleProducts] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      include: {
        images: { where: { isMain: true }, take: 1 },
        brand: { select: { name: true } },
        inventory: { select: { stock: true } },
        category: { select: { name: true, slug: true } },
      },
      take: 8,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { sortOrder: 'asc' },
      take: 9,
    }),
    prisma.brand.findMany({
      where: { isActive: true },
      take: 10,
    }),
    prisma.product.findMany({
      where: { isActive: true, isOnSale: true },
      include: {
        images: { where: { isMain: true }, take: 1 },
        brand: { select: { name: true } },
        inventory: { select: { stock: true } },
      },
      take: 4,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  return { featuredProducts, categories, brands, onSaleProducts };
}

export default async function HomePage() {
  const { featuredProducts, categories, brands, onSaleProducts } = await getHomeData();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        <HeroSection />

        <FeaturedCategories categories={categories} />

        {onSaleProducts.length > 0 && (
          <OffersBanner products={onSaleProducts} />
        )}

        <Suspense fallback={<div className="h-96 shimmer" />}>
          <FeaturedProducts products={featuredProducts} title="Destacados" />
        </Suspense>

        <BeautyAssistantBanner />

        <HairDiagnosisBanner />

        <BrandsCarousel brands={brands} />
      </main>

      <Footer />
    </div>
  );
}
