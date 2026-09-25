import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { normalizeProductMedia, normalizeProductsMedia } from '@/lib/images';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductDetail from '@/components/shop/ProductDetail';
import FeaturedProducts from '@/components/shop/FeaturedProducts';

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://divinittys.cl').replace(/\/$/, '');

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    select: {
      name: true,
      shortDescription: true,
      description: true,
      descriptionMl: true,
      slug: true,
      basePrice: true,
      isActive: true,
      images: { where: { isMain: true }, take: 1, select: { url: true, alt: true } },
      brand: { select: { name: true } },
    },
  });

  if (!product) {
    return { title: 'Producto no encontrado', robots: { index: false, follow: false } };
  }

  // Solo el nombre: el template del layout añade " | DIVINITTYS"
  const title = product.name;
  const description =
    product.shortDescription ||
    product.description?.slice(0, 160) ||
    product.descriptionMl?.slice(0, 160) ||
    `${product.name}${product.brand?.name ? ` — ${product.brand.name}` : ''} | Belleza profesional en DIVINITTYS`;

  const canonical = `${siteUrl}/productos/${product.slug}`;
  const imageUrl = product.images[0]?.url;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      locale: 'es_CL',
      url: canonical,
      title: `${product.name} | DIVINITTYS`,
      description,
      siteName: 'DIVINITTYS',
      ...(imageUrl
        ? {
            images: [
              {
                url: imageUrl,
                alt: product.images[0]?.alt || product.name,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title: `${product.name} | DIVINITTYS`,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
    // Productos inactivos no deben indexarse (por si se llega por URL antigua)
    robots: product.isActive
      ? { index: true, follow: true }
      : { index: false, follow: false },
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
      mlReviews: {
        orderBy: [{ reviewedAt: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      },
    },
  });

  if (!product) notFound();

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

  const productWithDesc = {
    ...product,
    description: product.description?.trim() || product.descriptionMl || null,
  };

  const normalizedProduct = normalizeProductMedia(productWithDesc);
  const normalizedRelated = normalizeProductsMedia(related);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <ProductDetail product={normalizedProduct as any} />

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
