import { prisma } from '@/lib/prisma';
import { Tag, Users, Bell } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getMarketingData() {
  const [subscriberCount, activeCoupons, activePromotions] = await Promise.all([
    prisma.subscriber.count({ where: { isActive: true } }),
    prisma.coupon.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.promotion.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);
  return { subscriberCount, activeCoupons, activePromotions };
}

export default async function MarketingPage() {
  const { subscriberCount, activeCoupons, activePromotions } = await getMarketingData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-charcoal-700">Marketing</h1>
        <p className="font-sans text-muted-foreground mt-1">Campañas, cupones y suscriptores</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-champagne-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-primary-500" />
            <span className="font-sans text-sm font-semibold text-charcoal-600">Suscriptores</span>
          </div>
          <p className="font-display text-3xl font-light text-charcoal-700">{subscriberCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-champagne-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Tag className="w-5 h-5 text-primary-500" />
            <span className="font-sans text-sm font-semibold text-charcoal-600">Cupones activos</span>
          </div>
          <p className="font-display text-3xl font-light text-charcoal-700">{activeCoupons.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-champagne-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-5 h-5 text-primary-500" />
            <span className="font-sans text-sm font-semibold text-charcoal-600">Promociones activas</span>
          </div>
          <p className="font-display text-3xl font-light text-charcoal-700">{activePromotions.length}</p>
        </div>
      </div>

      {/* Coupons list */}
      <div className="bg-white rounded-2xl border border-champagne-100 p-6">
        <h2 className="font-sans font-semibold text-charcoal-700 mb-4">Cupones</h2>
        {activeCoupons.length === 0 ? (
          <p className="font-sans text-charcoal-400 text-sm">No hay cupones activos.</p>
        ) : (
          <div className="space-y-2">
            {activeCoupons.map((coupon: typeof activeCoupons[number]) => (
              <div key={coupon.id} className="flex items-center justify-between p-3 rounded-xl bg-champagne-50">
                <div>
                  <span className="font-mono font-bold text-primary-600">{coupon.code}</span>
                  <span className="font-sans text-sm text-charcoal-500 ml-3">
                    {coupon.type === 'PERCENTAGE' ? `${coupon.value}%` : `$${coupon.value}`} descuento
                  </span>
                </div>
                <span className="font-sans text-xs text-charcoal-400">
                  {coupon.maxUses ? `${coupon.usedCount}/${coupon.maxUses} usos` : `${coupon.usedCount} usos`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
