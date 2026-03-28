import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Plus, Upload } from 'lucide-react';
import AdminProductsClient from '@/components/admin/AdminProductsClient';

async function getProducts(page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        category:  { select: { name: true } },
        brand:     { select: { name: true } },
        images:    { where: { isMain: true }, take: 1 },
        inventory: { select: { stock: true } },
      },
    }),
    prisma.product.count(),
  ]);

  const normalized = products.map((p: any) => ({
    ...p,
    price:        Number(p.basePrice),
    basePrice:    Number(p.basePrice),
    comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
    // Ensure imageUrl is present (from direct field or first image)
    imageUrl:     p.imageUrl || p.images?.[0]?.url || null,
  }));

  return { products: normalized, total, totalPages: Math.ceil(total / limit) };
}

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page || '1'));
  const { products, total, totalPages } = await getProducts(page);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-charcoal-700">Productos</h1>
          <p className="font-sans text-muted-foreground mt-1">{total} productos en catálogo</p>
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

      <AdminProductsClient products={products as any} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Link key={p}
              href={`/admin/productos?page=${p}`}
              className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-sans font-semibold transition-colors ${
                p === page
                  ? 'bg-primary-500 text-white'
                  : 'bg-champagne-100 text-charcoal-600 hover:bg-champagne-200'
              }`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
