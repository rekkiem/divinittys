/**
 * ProductsGrid — Server Component
 * Usa Prisma. La búsqueda con `q` también filtra por marca (nombre).
 */
import { prisma } from '@/lib/prisma';
import ProductCard from './ProductCard';
import ProductsPagination from './ProductsPagination';
import SortSelector from './SortSelector';

const PAGE_SIZE = 24;

type SearchParams = { [key: string]: string | undefined };

function buildWhere(searchParams: SearchParams): any {
  const where: any = { isActive: true };

  if (searchParams.q) {
    const q = searchParams.q.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { brand: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }
  }

  if (searchParams.category) where.category = { slug: searchParams.category };
  if (searchParams.brand) where.brand = { slug: searchParams.brand };
  if (searchParams.onSale === 'true') where.isOnSale = true;

  if (searchParams.minPrice) {
    const n = Number(searchParams.minPrice);
    if (!Number.isNaN(n)) where.basePrice = { ...where.basePrice, gte: n };
  }
  if (searchParams.maxPrice) {
    const n = Number(searchParams.maxPrice);
    if (!Number.isNaN(n)) where.basePrice = { ...where.basePrice, lte: n };
  }

  return where;
}

function buildOrderBy(sort?: string): any {
  const sortMap: Record<string, any> = {
    newest: { createdAt: 'desc' },
    price_asc: { basePrice: 'asc' },
    price_desc: { basePrice: 'desc' },
    name_asc: { name: 'asc' },
    featured: { isFeatured: 'desc' },
  };
  return sortMap[sort || 'newest'] ?? { createdAt: 'desc' };
}

export default async function ProductsGrid({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;
  const sort = searchParams.sort || 'newest';
  const where = buildWhere(searchParams);

  let products: any[] = [];
  let total = 0;

  try {
    const [rows, count] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        take: PAGE_SIZE,
        skip,
        orderBy: buildOrderBy(sort),
        include: {
          images: { where: { isMain: true }, take: 1 },
          brand: { select: { name: true } },
          inventory: { select: { stock: true } },
          category: { select: { name: true, slug: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);
    products = rows;
    total = count;
  } catch (err) {
    console.error('[ProductsGrid] query failed', err);
    // Evita tumbar la página con error.tsx genérico
    return (
      <div className="text-center py-20">
        <p className="font-display text-4xl font-light text-charcoal-300 mb-4">
          Error al cargar productos
        </p>
        <p className="font-sans text-charcoal-400">
          Intenta recargar o buscar con otro término.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  if (!products.length) {
    return (
      <div className="text-center py-20">
        <p className="font-display text-4xl font-light text-charcoal-300 mb-4">Sin resultados</p>
        <p className="font-sans text-charcoal-400">
          No encontramos productos con esos filtros. Intenta con otros criterios.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="font-sans text-sm text-charcoal-400">
          <span className="font-semibold text-charcoal-700">{total}</span> productos
        </p>
        <SortSelector currentSort={sort} searchParams={searchParams} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product: any, i: number) => (
          <ProductCard
            key={product.id}
            product={{
              ...product,
              basePrice: Number(product.basePrice),
              comparePrice: product.comparePrice != null ? Number(product.comparePrice) : null,
              images: product.images || [],
            }}
            index={i}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <ProductsPagination
          currentPage={page}
          totalPages={totalPages}
          searchParams={searchParams}
        />
      )}
    </div>
  );
}
