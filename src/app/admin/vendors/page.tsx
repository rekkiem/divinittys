import { prisma } from '@/lib/prisma';
import { Store } from 'lucide-react';

async function getVendors() {
  return prisma.vendor.findMany({
    include: {
      user:     { select: { email: true, name: true } },
      _count:   { select: { products: true, payouts: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export default async function VendorsPage() {
  const vendors = await getVendors();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-charcoal-700">Vendedores</h1>
        <p className="font-sans text-muted-foreground mt-1">{vendors.length} vendedores registrados</p>
      </div>

      <div className="bg-white rounded-2xl border border-champagne-100 overflow-hidden">
        {vendors.length === 0 ? (
          <div className="text-center py-16">
            <Store className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
            <p className="font-sans text-charcoal-400">No hay vendedores registrados aún.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-champagne-100 bg-champagne-50/50">
                {['Tienda', 'Email', 'Productos', 'Comisión', 'Estado'].map((h) => (
                  <th key={h} className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-champagne-50">
              {vendors.map((vendor: (typeof vendors)[number]) => (
                <tr key={vendor.id} className="hover:bg-champagne-50/30">
                  <td className="px-4 py-3">
                    <p className="font-sans font-semibold text-sm text-charcoal-700">{vendor.shopName}</p>
                    <p className="font-mono text-xs text-charcoal-400">@{vendor.slug}</p>
                  </td>
                  <td className="px-4 py-3 font-sans text-sm text-charcoal-500">{vendor.user.email}</td>
                  <td className="px-4 py-3 font-sans text-sm font-semibold text-primary-600">{vendor._count.products}</td>
                  <td className="px-4 py-3 font-sans text-sm text-charcoal-500">{Number(vendor.commission) * 100}%</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      vendor.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-charcoal-100 text-charcoal-500'
                    }`}>
                      {vendor.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
