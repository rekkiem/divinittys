
export const dynamic = 'force-dynamic';

export const revalidate = 300;

import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductsGrid from '@/components/shop/ProductsGrid';
import ProductsFilters from '@/components/shop/ProductsFilters';

export const metadata = {
  title: 'Catálogo de Productos | DIVINITTYS',
  description: 'Explora nuestra colección completa de productos de belleza y cuidado capilar.',
};

async function getFiltersData() {
  try {
    const [categories, brands, priceRange] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.product.aggregate({
      where: { isActive: true },
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
  } catch (error) {
    console.error('Filters fallback due to unavailable database:', error);
    return { categories: [], brands: [], minPrice: 0, maxPrice: 100000 };
  }
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const filtersData = await getFiltersData();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* Header */}
        <div className="py-12 px-4 max-w-7xl mx-auto">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-sans text-primary-500 text-xs font-semibold tracking-widest uppercase mb-2">
                Nuestro catálogo
              </p>
              <h1 className="section-title">
                {searchParams.q
                  ? `Resultados para "${searchParams.q}"`
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
            {/* Sidebar Filters */}
            <aside className="lg:w-64 shrink-0">
              <ProductsFilters
                categories={filtersData.categories}
                brands={filtersData.brands}
                minPrice={filtersData.minPrice}
                maxPrice={filtersData.maxPrice}
                searchParams={searchParams}
              />
            </aside>

            {/* Products */}
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
