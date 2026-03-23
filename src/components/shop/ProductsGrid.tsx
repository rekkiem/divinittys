/**
 * ProductsGrid — Server Component
 *
 * RSC RULES FOLLOWED:
 * ✅ No event handlers (onChange, onClick, etc.)
 * ✅ No useState / useEffect
 * ✅ Data fetching via Prisma directly
 * ✅ Passes only serializable props to Client Components
 * ✅ Delegates interactivity to SortSelector (Client) + ProductsPagination (Client)
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
    where.OR = [
      { name:        { contains: searchParams.q, mode: 'insensitive' } },
      { description: { contains: searchParams.q, mode: 'insensitive' } },
      { sku:         { contains: searchParams.q, mode: 'insensitive' } },
      { brand:       { name: { contains: searchParams.q, mode: 'insensitive' } } },
    ];
  }

  if (searchParams.category) where.category = { slug: searchParams.category };
  if (searchParams.brand)    where.brand    = { slug: searchParams.brand };
  if (searchParams.onSale === 'true') where.isOnSale = true;

  if (searchParams.minPrice) {
    where.basePrice = { ...where.basePrice, gte: Number(searchParams.minPrice) };
  }
  if (searchParams.maxPrice) {
    where.basePrice = { ...where.basePrice, lte: Number(searchParams.maxPrice) };
  }

  return where;
}

function buildOrderBy(sort?: string): any {
  const sortMap: Record<string, any> = {
    newest:     { createdAt: 'desc' },
    price_asc:  { basePrice: 'asc' },
    price_desc: { basePrice: 'desc' },
    name_asc:   { name: 'asc' },
    featured:   { isFeatured: 'desc' },
  };
  return sortMap[sort || 'newest'] ?? { createdAt: 'desc' };
}

export default async function ProductsGrid({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page  = Math.max(1, parseInt(searchParams.page || '1'));
  const skip  = (page - 1) * PAGE_SIZE;
  const sort  = searchParams.sort || 'newest';
  const where = buildWhere(searchParams);

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      take: PAGE_SIZE,
      skip,
      orderBy: buildOrderBy(sort),
      include: {
        images:    { where: { isMain: true }, take: 1 },
        brand:     { select: { name: true } },
        inventory: { select: { stock: true } },
        category:  { select: { name: true, slug: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
      {/* Header row: count + sort */}
      <div className="flex items-center justify-between mb-6">
        <p className="font-sans text-sm text-charcoal-400">
          <span className="font-semibold text-charcoal-700">{total}</span> productos
        </p>

        {/* ✅ CORRECTO: SortSelector es Client Component — recibe solo datos serializables */}
        <SortSelector currentSort={sort} searchParams={searchParams} />
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product: any, i: number) => (
          <ProductCard key={product.id} product={product} index={i} />
        ))}
      </div>

      {/* Pagination */}
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
