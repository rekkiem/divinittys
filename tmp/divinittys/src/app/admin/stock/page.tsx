import { prisma } from '@/lib/prisma';
import { BarChart3 } from 'lucide-react';

async function getStock() {
  return prisma.inventory.findMany({
    orderBy: { stock: 'asc' },
    include: { product: { select: { name: true, sku: true, category: { select: { name: true } } } } },
  });
}

export default async function StockPage() {
  const inventory = await getStock();
  const low = inventory.filter((i: any) => i.stock <= i.lowStockThreshold && i.trackStock);
  const outOfStock = inventory.filter((i: any) => i.stock === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-charcoal-700">Gestión de Stock</h1>
        <p className="font-sans text-muted-foreground mt-1">{inventory.length} productos con inventario</p>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Sin stock', value: outOfStock.length, cls: 'text-red-600 bg-red-50 border-red-200' },
          { label: 'Stock bajo', value: low.length,       cls: 'text-amber-600 bg-amber-50 border-amber-200' },
          { label: 'Total SKUs', value: inventory.length, cls: 'text-charcoal-700 bg-white border-champagne-100' },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`rounded-2xl border p-5 ${cls}`}>
            <p className="font-sans text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
            <p className="font-display text-3xl font-light">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-champagne-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-champagne-100 bg-champagne-50/50">
                {['Producto', 'SKU', 'Categoría', 'Stock', 'Reservado', 'Umbral', 'Estado'].map(h => (
                  <th key={h} className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-champagne-50">
              {inventory.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16">
                  <BarChart3 className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
                  <p className="font-sans text-charcoal-400">Sin datos de inventario</p>
                </td></tr>
              ) : (inventory as any[]).map((inv) => {
                const stockStatus = inv.stock === 0 ? 'Sin stock' : inv.stock <= inv.lowStockThreshold ? 'Stock bajo' : 'OK';
                const statusCls = inv.stock === 0 ? 'bg-red-100 text-red-600' : inv.stock <= inv.lowStockThreshold ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                return (
                  <tr key={inv.id} className="hover:bg-champagne-50/30">
                    <td className="px-4 py-3"><span className="font-sans font-medium text-sm text-charcoal-700">{inv.product.name}</span></td>
                    <td className="px-4 py-3"><span className="font-mono text-xs text-charcoal-400">{inv.product.sku}</span></td>
                    <td className="px-4 py-3"><span className="font-sans text-sm text-charcoal-500">{inv.product.category?.name || '—'}</span></td>
                    <td className="px-4 py-3"><span className={`font-sans font-bold text-sm ${inv.stock === 0 ? 'text-red-500' : inv.stock <= inv.lowStockThreshold ? 'text-amber-600' : 'text-charcoal-700'}`}>{inv.stock}</span></td>
                    <td className="px-4 py-3"><span className="font-sans text-sm text-charcoal-500">{inv.reservedStock}</span></td>
                    <td className="px-4 py-3"><span className="font-sans text-sm text-charcoal-500">{inv.lowStockThreshold}</span></td>
                    <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold font-sans ${statusCls}`}>{stockStatus}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
