import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Plus, Upload } from 'lucide-react';
import AdminProductsClient from '@/components/admin/AdminProductsClient';

async function getProducts(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        images: { where: { isMain: true }, take: 1 },
        inventory: { select: { stock: true } },
      },
    }),
    prisma.product.count(),
  ]);

  // Normalize to ensure consistent field names
  const normalized = products.map((p) => ({
    ...p,
    price: Number(p.basePrice),
    comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
  }));

  return { products: normalized, total, totalPages: Math.ceil(total / limit) };
}

export default async function AdminProductsPage() {
  const { products, total } = await getProducts();

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
    </div>
  );
}
