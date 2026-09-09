export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { BarChart3 } from 'lucide-react';
import AdminPagination from '@/components/admin/AdminPagination';
import ExportExcelButton from '@/components/admin/ExportExcelButton';

const ALLOWED_LIMITS = new Set([50, 100]);

async function getStock(page: number, limit: number, q?: string, lowOnly?: boolean) {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (q) {
    where.product = {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ],
    };
  }

  // Prisma no compara dos columnas en where de forma nativa de forma portable.
  // Estrategia eficiente: paginar el universo filtrado por búsqueda; el flag
  // "stock bajo" se aplica en memoria solo sobre la página actual + contadores
  // globales ligeros.
  const [allForStats, pageRows, total] = await prisma.$transaction([
    // Solo campos necesarios para cards de alerta (sin product)
    prisma.inventory.findMany({
      select: { stock: true, lowStockThreshold: true, trackStock: true },
    }),
    prisma.inventory.findMany({
      where,
      orderBy: { stock: 'asc' },
      skip,
      take: limit,
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            category: { select: { name: true } },
          },
        },
      },
    }),
    prisma.inventory.count({ where }),
  ]);

  const lowCount = allForStats.filter(
    (i) => i.trackStock && i.stock <= i.lowStockThreshold
  ).length;
  const outCount = allForStats.filter((i) => i.stock === 0).length;

  let inventory = pageRows;
  if (lowOnly) {
    inventory = pageRows.filter((i) => i.trackStock && i.stock <= i.lowStockThreshold);
  }

  return {
    inventory,
    total: lowOnly ? inventory.length : total,
    totalPages: Math.ceil((lowOnly ? inventory.length : total) / limit) || 1,
    lowCount,
    outCount,
    totalSkus: allForStats.length,
  };
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: { page?: string; limit?: string; q?: string; lowStock?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const rawLimit = parseInt(searchParams.limit || '50', 10) || 50;
  const limit = ALLOWED_LIMITS.has(rawLimit) ? rawLimit : 50;
  const q = (searchParams.q || '').trim();
  const lowStock = searchParams.lowStock === '1';

  const { inventory, total, totalPages, lowCount, outCount, totalSkus } = await getStock(
    page,
    limit,
    q || undefined,
    lowStock
  );

  const exportQuery = new URLSearchParams();
  if (q) exportQuery.set('q', q);
  if (lowStock) exportQuery.set('lowStock', '1');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium text-charcoal-700">Gestión de Stock</h1>
          <p className="font-sans text-muted-foreground mt-1">
            {totalSkus} productos con inventario
          </p>
        </div>
        <ExportExcelButton
          endpoint="/api/admin/stock/export"
          query={exportQuery.toString()}
          filename="stock-divinittys.xlsx"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Sin stock',
            value: outCount,
            cls: 'text-red-600 bg-red-50 border-red-200',
          },
          {
            label: 'Stock bajo',
            value: lowCount,
            cls: 'text-amber-600 bg-amber-50 border-amber-200',
          },
          {
            label: 'Total SKUs',
            value: totalSkus,
            cls: 'text-charcoal-700 bg-white border-champagne-100',
          },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`rounded-2xl border p-5 ${cls}`}>
            <p className="font-sans text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
            <p className="font-display text-3xl font-light">{value}</p>
          </div>
        ))}
      </div>

      <form method="get" className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px] max-w-md">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o SKU…"
            className="input-field text-sm py-2 w-full"
          />
        </div>
        <label className="flex items-center gap-2 font-sans text-sm text-charcoal-600 px-2">
          <input type="checkbox" name="lowStock" value="1" defaultChecked={lowStock} />
          Solo stock bajo
        </label>
        <input type="hidden" name="limit" value={limit} />
        <button type="submit" className="btn-secondary text-sm px-4 py-2">
          Filtrar
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-champagne-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-champagne-100 bg-champagne-50/50">
                {['Producto', 'SKU', 'Categoría', 'Stock', 'Reservado', 'Umbral', 'Estado'].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-champagne-50">
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <BarChart3 className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
                    <p className="font-sans text-charcoal-400">Sin datos de inventario</p>
                  </td>
                </tr>
              ) : (
                (inventory as any[]).map((inv) => {
                  const stockStatus =
                    inv.stock === 0
                      ? 'Sin stock'
                      : inv.stock <= inv.lowStockThreshold
                        ? 'Stock bajo'
                        : 'OK';
                  const statusCls =
                    inv.stock === 0
                      ? 'bg-red-100 text-red-600'
                      : inv.stock <= inv.lowStockThreshold
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700';
                  return (
                    <tr key={inv.id} className="hover:bg-champagne-50/30">
                      <td className="px-4 py-3">
                        <span className="font-sans font-medium text-sm text-charcoal-700">
                          {inv.product.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-charcoal-400">
                          {inv.product.sku}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-sans text-sm text-charcoal-500">
                          {inv.product.category?.name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-sans font-bold text-sm ${
                            inv.stock === 0
                              ? 'text-red-500'
                              : inv.stock <= inv.lowStockThreshold
                                ? 'text-amber-600'
                                : 'text-charcoal-700'
                          }`}
                        >
                          {inv.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-sans text-sm text-charcoal-500">
                          {inv.reservedStock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-sans text-sm text-charcoal-500">
                          {inv.lowStockThreshold}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold font-sans ${statusCls}`}
                        >
                          {stockStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        preserveKeys={['q', 'lowStock']}
      />
    </div>
  );
}
