import dynamicImport from 'next/dynamic';
import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { normalizeProductsMedia } from '@/lib/images';
import HeroSection from '@/components/shop/HeroSection';
import FeaturedCategories from '@/components/shop/FeaturedCategories';
import FeaturedProducts from '@/components/shop/FeaturedProducts';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import OffersBanner from '@/components/shop/OffersBanner';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'DIVINITTYS | Productos de Belleza Profesional',
  description: 'Encuentra los mejores productos de belleza profesional: shampoos, tinturas, tratamientos y más. Envío gratis sobre $50.000.',
  keywords: ['belleza', 'peluquería', 'shampoo', 'tintura', 'Davines', 'Elgon', 'Chile'],
  openGraph: {
    title: 'DIVINITTYS | Productos de Belleza Profesional',
    description: 'Tu tienda online de belleza profesional en Chile',
    type: 'website',
  },
};

const BeautyAssistantBanner = dynamicImport(() => import('@/components/ai/BeautyAssistantBanner'));
const HairDiagnosisBanner = dynamicImport(() => import('@/components/ai/HairDiagnosisBanner'));
const BrandsCarousel = dynamicImport(() => import('@/components/shop/BrandsCarousel'));

const getHomeData = unstable_cache(
  async () => {
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

    return {
      featuredProducts: normalizeProductsMedia(featuredProducts),
      categories,
      brands,
      onSaleProducts: normalizeProductsMedia(onSaleProducts),
    };
  },
  ['home-data'],
  { revalidate: 300, tags: ['home'] }
);

export default async function HomePage() {
  const { featuredProducts, categories, brands, onSaleProducts } = await getHomeData();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        <HeroSection />

        <FeaturedCategories categories={categories} />

        {onSaleProducts.length > 0 && (
          <OffersBanner products={onSaleProducts as any} />
        )}

        <Suspense fallback={<div className="h-96 shimmer" />}>
          <FeaturedProducts products={featuredProducts as any} title="Destacados" />
        </Suspense>

        <BeautyAssistantBanner />

        <HairDiagnosisBanner />

        <BrandsCarousel brands={brands} />
      </main>

      <Footer />
    </div>
  );
}
