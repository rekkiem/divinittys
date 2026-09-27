import { Suspense } from 'react';
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductsGrid from '@/components/shop/ProductsGrid';
import ProductsFilters from '@/components/shop/ProductsFilters';

export const dynamic = 'force-dynamic';

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://divinittys.cl').replace(/\/$/, '');

/** Parámetros de filtro/paginación / scope que no deben generar páginas indexables. */
const FILTER_PARAMS = new Set([
  'q', 'category', 'brand', 'onSale', 'page', 'sort', 'minPrice', 'maxPrice',
  'priceMin', 'priceMax', 'tag', 'inStock', 'scope',
]);

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}): Promise<Metadata> {
  const hasFilters = Object.keys(searchParams || {}).some((k) => FILTER_PARAMS.has(k));
  const isSecondary = searchParams?.scope === 'secondary';

  const title = searchParams?.q
    ? `Búsqueda: ${searchParams.q}`
    : isSecondary
    ? 'Otros productos'
    : searchParams?.onSale === 'true'
    ? 'Ofertas'
    : searchParams?.category
    ? 'Categoría'
    : 'Catálogo de Productos';

  return {
    title,
    description: isSecondary
      ? 'Accesorios, regalos y otros productos fuera del catálogo de belleza profesional.'
      : 'Explora nuestra colección de productos de belleza y cuidado capilar profesional.',
    alternates: {
      canonical: `${siteUrl}/productos`,
    },
    robots: hasFilters || isSecondary
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

/** Categorías/marcas del sidebar solo del scope activo (sin mezcla BEAUTY/SECONDARY). */
async function getFiltersData(scope: 'BEAUTY' | 'SECONDARY') {
  const productScopeFilter = {
    isActive: true,
    catalogScope: scope,
  } as const;

  const [categories, brands, priceRange] = await Promise.all([
    prisma.category.findMany({
      where: {
        isActive: true,
        products: { some: productScopeFilter },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.brand.findMany({
      where: {
        isActive: true,
        products: { some: productScopeFilter },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.product.aggregate({
      where: productScopeFilter,
      _min: { basePrice: true },
      _max: { basePrice: true },
    }),
  ]);

  return {
    categories,
    brands,
    minPrice: Number(priceRange._min.basePrice || 0),
    maxPrice: Number(priceRange._max.basePrice || 100000),
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const scope = searchParams.scope === 'secondary' ? 'SECONDARY' : 'BEAUTY';
  const filtersData = await getFiltersData(scope);
  const isSecondary = scope === 'SECONDARY';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <div className="py-12 px-4 max-w-7xl mx-auto">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-sans text-primary-500 text-xs font-semibold tracking-widest uppercase mb-2">
                {isSecondary ? 'Anexo' : 'Nuestro catálogo'}
              </p>
              <h1 className="section-title">
                {searchParams.q
                  ? `Resultados para "${searchParams.q}"`
                  : isSecondary
                  ? 'Otros productos'
                  : searchParams.category
                  ? 'Categoría'
                  : searchParams.onSale === 'true'
                  ? 'Ofertas'
                  : 'Todos los Productos'}
              </h1>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-20">
          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="lg:w-64 shrink-0">
              <ProductsFilters
                categories={filtersData.categories}
                brands={filtersData.brands}
                minPrice={filtersData.minPrice}
                maxPrice={filtersData.maxPrice}
                searchParams={searchParams}
              />
            </aside>

            <div className="flex-1">
              <Suspense fallback={<div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({length:6}).map((_,i)=><div key={i} className="aspect-square shimmer rounded-2xl"/>)}</div>}>
                <ProductsGrid searchParams={searchParams} />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
