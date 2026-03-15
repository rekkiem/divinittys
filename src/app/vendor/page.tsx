import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function VendorDashboardPage() {
  const [vendorsCount, productsCount, payoutsCount] = await Promise.all([
    prisma.vendor.count(),
    prisma.product.count({ where: { vendorId: { not: null } } }),
    prisma.vendorPayout.count(),
  ]);

  return (
    <main className="container py-10 space-y-6">
      <h1 className="text-3xl font-semibold">Panel Vendor</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-product p-4"><p className="text-sm">Vendors</p><p className="text-2xl font-bold">{vendorsCount}</p></div>
        <div className="card-product p-4"><p className="text-sm">Productos marketplace</p><p className="text-2xl font-bold">{productsCount}</p></div>
        <div className="card-product p-4"><p className="text-sm">Payouts</p><p className="text-2xl font-bold">{payoutsCount}</p></div>
      </div>
    </main>
  );
}
