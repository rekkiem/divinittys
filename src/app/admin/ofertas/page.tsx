import { prisma } from '@/lib/prisma';
import { Percent } from 'lucide-react';
import { formatCLP } from '@/lib/utils/api';

export const dynamic = 'force-dynamic';

export default async function OfertasPage() {
  const onSaleProducts = await prisma.product.findMany({
    where: { isOnSale: true, isActive: true },
    include: { images: { where: { isMain: true }, take: 1 }, category: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-charcoal-700">Ofertas y Descuentos</h1>
        <p className="font-sans text-muted-foreground mt-1">{onSaleProducts.length} productos en oferta</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="font-sans text-sm text-amber-700">
          Para activar una oferta, edita el producto y marca &quot;En oferta&quot; + ingresa un precio de comparación mayor al precio base.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-champagne-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-champagne-100 bg-champagne-50/50">
              {['Producto', 'Categoría', 'Precio oferta', 'Precio original', 'Descuento', 'Acciones'].map(h => (
                <th key={h} className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-champagne-50">
            {onSaleProducts.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-16">
                <Percent className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
                <p className="font-sans text-charcoal-400">No hay productos en oferta</p>
              </td></tr>
            ) : (onSaleProducts as any[]).map(p => {
              const discount = p.comparePrice
                ? Math.round((1 - Number(p.basePrice) / Number(p.comparePrice)) * 100)
                : 0;
              return (
                <tr key={p.id} className="hover:bg-champagne-50/30">
                  <td className="px-4 py-3"><span className="font-sans font-medium text-sm text-charcoal-700">{p.name}</span></td>
                  <td className="px-4 py-3"><span className="font-sans text-sm text-charcoal-500">{p.category?.name || '—'}</span></td>
                  <td className="px-4 py-3"><span className="font-sans font-bold text-sm text-primary-600">{formatCLP(Number(p.basePrice))}</span></td>
                  <td className="px-4 py-3"><span className="font-sans text-sm text-charcoal-400 line-through">{p.comparePrice ? formatCLP(Number(p.comparePrice)) : '—'}</span></td>
                  <td className="px-4 py-3">
                    {discount > 0 && <span className="inline-block px-2 py-0.5 bg-rose-100 text-rose-600 text-xs font-bold rounded-full">-{discount}%</span>}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/admin/productos/${p.slug}/editar`} className="font-sans text-xs text-primary-500 hover:underline">Editar →</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
