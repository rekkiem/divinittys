import { prisma } from '@/lib/prisma';
import ProductCard from './ProductCard';
import ProductsPagination from './ProductsPagination';

const PAGE_SIZE = 24;

export default async function ProductsGrid({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const page = parseInt(searchParams.page || '1');
  const skip = (page - 1) * PAGE_SIZE;

  const where: any = { isActive: true };

  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: 'insensitive' } },
      { description: { contains: searchParams.q, mode: 'insensitive' } },
      { sku: { contains: searchParams.q, mode: 'insensitive' } },
      { brand: { name: { contains: searchParams.q, mode: 'insensitive' } } },
    ];
  }
  if (searchParams.category) where.category = { slug: searchParams.category };
  if (searchParams.brand) where.brand = { slug: searchParams.brand };
  if (searchParams.onSale === 'true') where.isOnSale = true;
  if (searchParams.minPrice) where.basePrice = { ...where.basePrice, gte: Number(searchParams.minPrice) };
  if (searchParams.maxPrice) where.basePrice = { ...where.basePrice, lte: Number(searchParams.maxPrice) };

  const sortMap: Record<string, any> = {
    newest: { createdAt: 'desc' },
    price_asc: { basePrice: 'asc' },
    price_desc: { basePrice: 'desc' },
    name_asc: { name: 'asc' },
    featured: { isFeatured: 'desc' },
  };
  const orderBy = sortMap[searchParams.sort || 'newest'] || { createdAt: 'desc' };

  let products: any[] = [];
  let total = 0;

  try {
    [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      take: PAGE_SIZE,
      skip,
      orderBy,
      include: {
        images: { where: { isMain: true }, take: 1 },
        brand: { select: { name: true } },
        inventory: { select: { stock: true } },
        category: { select: { name: true, slug: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  } catch (error) {
    console.error('Products grid fallback due to unavailable database:', error);
    products = [];
    total = 0;
  }

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
      <div className="flex items-center justify-between mb-6">
        <p className="font-sans text-sm text-charcoal-400">
          <span className="font-semibold text-charcoal-700">{total}</span> productos
        </p>
        <select
          name="sort"
          defaultValue={searchParams.sort || 'newest'}
          className="input-field !w-auto !py-2 text-sm"
          onChange={(e) => {
            const url = new URL(window.location.href);
            url.searchParams.set('sort', e.target.value);
            window.location.href = url.toString();
          }}
        >
          <option value="newest">Más recientes</option>
          <option value="price_asc">Precio: menor a mayor</option>
          <option value="price_desc">Precio: mayor a menor</option>
          <option value="name_asc">Nombre A-Z</option>
          <option value="featured">Destacados</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product, i) => (
          <ProductCard key={product.id} product={product} index={i} />
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
