import { prisma } from '@/lib/prisma';
import { normalizeProductMedia } from '@/lib/images';
import Link from 'next/link';
import { Plus, Upload } from 'lucide-react';
import AdminProductsClient from '@/components/admin/AdminProductsClient';

async function getProducts(page = 1, limit = 100, q?: string) {
  const skip = (page - 1) * limit;
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { sku: { contains: q, mode: 'insensitive' as const } },
          { tags: { has: q.toLowerCase() } },
          { brand: { name: { contains: q, mode: 'insensitive' as const } } },
        ],
      }
    : {};

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        images: { where: { isMain: true }, take: 1 },
        inventory: { select: { stock: true } },
        _count: { select: { variants: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const normalized = products.map((p: any) => {
    const product = normalizeProductMedia(p);
    return {
      ...product,
      price: Number(p.basePrice),
      basePrice: Number(p.basePrice),
      comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
      imageUrl: product.imageUrl || product.images?.[0]?.url || null,
      variantCount: p._count?.variants ?? 0,
    };
  });

  return { products: normalized, total, totalPages: Math.ceil(total / limit) || 1 };
}

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const q = (searchParams.q || '').trim();
  const { products, total, totalPages } = await getProducts(page, 100, q || undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-charcoal-700">Productos</h1>
          <p className="font-sans text-muted-foreground mt-1">
            {total} productos{q ? ` · filtro "${q}"` : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/importar" className="btn-secondary flex items-center gap-2 text-sm py-2">
            <Upload className="w-4 h-4" />
            Importar Excel
          </Link>
          <Link href="/admin/productos/nuevo" className="btn-primary flex items-center gap-2 text-sm py-2">
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </Link>
        </div>
      </div>

      <form method="get" className="flex gap-2 max-w-md">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar en todo el catálogo (nombre, SKU, marca)..."
          className="input-field flex-1 text-sm py-2"
        />
        <button type="submit" className="btn-secondary text-sm px-4">
          Buscar
        </button>
      </form>

      <AdminProductsClient products={products as any} />

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 flex-wrap">
          {Array.from({ length: Math.min(totalPages, 20) }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/productos?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-sans font-semibold ${
                p === page
                  ? 'bg-primary-500 text-white'
                  : 'bg-champagne-100 text-charcoal-600 hover:bg-champagne-200'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
