import { prisma } from '@/lib/prisma';
import { Megaphone } from 'lucide-react';

async function getPromotions() {
  return prisma.promotion.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export default async function PromotionsPage() {
  const promotions = await getPromotions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-charcoal-700">Promociones</h1>
        <p className="font-sans text-muted-foreground mt-1">Banners, popups y campañas</p>
      </div>

      <div className="bg-white rounded-2xl border border-champagne-100 overflow-hidden">
        {promotions.length === 0 ? (
          <div className="text-center py-16">
            <Megaphone className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
            <p className="font-sans text-charcoal-400">No hay promociones creadas.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-champagne-100 bg-champagne-50/50">
                {['Título', 'Tipo', 'Estado', 'Período'].map((h) => (
                  <th key={h} className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-champagne-50">
              {promotions.map((promotion: (typeof promotions)[number]) => (
                <tr key={promotion.id} className="hover:bg-champagne-50/30">
                  <td className="px-4 py-3 font-sans font-medium text-charcoal-700 text-sm">{promotion.title}</td>
                  <td className="px-4 py-3 font-sans text-sm text-charcoal-500">{promotion.type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      promotion.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-charcoal-100 text-charcoal-500'
                    }`}>
                      {promotion.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-sans text-xs text-charcoal-400">
                    {promotion.startsAt && promotion.endsAt
                      ? `${new Date(promotion.startsAt).toLocaleDateString('es-CL')} → ${new Date(promotion.endsAt).toLocaleDateString('es-CL')}`
                      : 'Sin fechas'}
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
