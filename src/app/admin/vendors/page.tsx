import { prisma } from '@/lib/prisma';

export default async function AdminVendorsPage() {
  const vendors = await prisma.vendor.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold mb-4">Vendors</h1>
      <div className="space-y-3">
        {vendors.map((vendor) => (
          <div key={vendor.id} className="card-product p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{vendor.storeName}</p>
              <p className="text-sm text-muted-foreground">{vendor.user.email} · {vendor.status}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
