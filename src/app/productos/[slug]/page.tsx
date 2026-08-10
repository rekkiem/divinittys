import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { normalizeProductMedia, normalizeProductsMedia } from '@/lib/images';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductDetail from '@/components/shop/ProductDetail';
import FeaturedProducts from '@/components/shop/FeaturedProducts';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    select: { name: true, shortDescription: true },
  });
  if (!product) return { title: 'Producto no encontrado' };
  return {
    title: `${product.name} | DIVINITTYS`,
    description: product.shortDescription || undefined,
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug, isActive: true },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      brand: true,
      category: { include: { parent: true } },
      inventory: true,
      attributes: true,
      variants: { where: { isActive: true } },
      reviews: {
        where: { status: 'APPROVED' },
        include: { user: { select: { name: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!product) notFound();

  // Related products
  const related = await prisma.product.findMany({
    where: {
      isActive: true,
      categoryId: product.categoryId,
      id: { not: product.id },
    },
    take: 4,
    include: {
      images: { where: { isMain: true }, take: 1 },
      brand: { select: { name: true } },
      inventory: { select: { stock: true } },
    },
  });

  const normalizedProduct = normalizeProductMedia(product);
  const normalizedRelated = normalizeProductsMedia(related);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <ProductDetail product={normalizedProduct} />

        {normalizedRelated.length > 0 && (
          <div className="border-t border-champagne-200 mt-16 pt-4">
            <FeaturedProducts products={normalizedRelated as any} title="Productos Relacionados" />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
