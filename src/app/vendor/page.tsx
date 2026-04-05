import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { Package } from 'lucide-react';

async function getVendorData(userId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { userId },
    include: { _count: { select: { products: true } } },
  });
  if (!vendor) return null;

  const [products, payouts] = await Promise.all([
    prisma.product.findMany({
      where: { vendorId: vendor.id },
      include: { inventory: { select: { stock: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.vendorPayout.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return { vendor, products, payouts };
}

export default async function VendorPage() {
  // Note: Full auth requires middleware integration
  // For now, show a placeholder if no vendor context
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-3xl font-medium text-charcoal-700">Panel de Vendedor</h1>
          <p className="font-sans text-muted-foreground mt-1">Gestiona tus productos y pagos</p>
        </div>
        <div className="bg-white rounded-2xl border border-champagne-100 p-8 text-center">
          <Package className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
          <p className="font-sans text-charcoal-500">
            Inicia sesión como vendedor para acceder a tu panel.
          </p>
        </div>
      </div>
    </div>
  );
}
