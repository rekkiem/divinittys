import { prisma } from '@/lib/prisma';

export default async function AdminMarketingPage() {
  const [coupons, subscribers] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.subscriber.count(),
  ]);

  return (
    <main className="container py-10 space-y-4">
      <h1 className="text-2xl font-semibold">Marketing</h1>
      <p className="text-sm">Suscriptores newsletter: {subscribers}</p>
      {coupons.map((coupon) => (
        <div key={coupon.id} className="card-product p-4 flex justify-between">
          <p>{coupon.code}</p>
          <p className="text-sm">{coupon.type} - {Number(coupon.value)}</p>
        </div>
      ))}
    </main>
  );
}
