import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductDetail from '@/components/shop/ProductDetail';
import FeaturedProducts from '@/components/shop/FeaturedProducts';

export const revalidate = 300;

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
      vendor: true,
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription || product.description || '',
    image: product.images.map((img) => img.url),
    sku: product.sku,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'CLP',
      price: Number(product.basePrice),
      availability: product.inventory?.stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main>
        <ProductDetail product={product} />

        {related.length > 0 && (
          <div className="border-t border-champagne-200 mt-16 pt-4">
            <FeaturedProducts products={related} title="Productos Relacionados" />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
