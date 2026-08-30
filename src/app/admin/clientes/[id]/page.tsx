export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ClienteDetailClient from './ClienteDetailClient';

async function getClient(id: string) {
  // No seleccionar passwordHash: Prisma 6 + filas NULL → P2032 en runtime.
  // hasPassword se deriva con count paralelo.
  const [client, hasPassword] = await Promise.all([
    prisma.user.findFirst({
      where: { id, role: 'CUSTOMER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            total: true,
            createdAt: true,
          },
        },
        _count: { select: { orders: true, addresses: true } },
      },
    }),
    prisma.user
      .count({ where: { id, role: 'CUSTOMER', passwordHash: { not: null } } })
      .then((c) => c > 0),
  ]);

  return client ? { ...client, hasPassword } : null;
}

export default async function ClienteDetailPage({ params }: { params: { id: string } }) {
  const client = await getClient(params.id);
  if (!client) notFound();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/clientes"
          className="p-2 rounded-lg hover:bg-muted transition-colors text-charcoal-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-medium text-charcoal-700">
            {client.name || 'Cliente sin nombre'}
          </h1>
          <p className="font-sans text-sm text-muted-foreground">{client.email}</p>
        </div>
      </div>

      <ClienteDetailClient
        client={{
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          isActive: client.isActive,
          hasPassword: client.hasPassword,
          createdAt: client.createdAt.toISOString(),
          updatedAt: client.updatedAt.toISOString(),
          addresses: client.addresses.map((a) => ({
            ...a,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString(),
          })),
          orders: client.orders.map((o) => ({
            ...o,
            total: Number(o.total),
            createdAt: o.createdAt.toISOString(),
          })),
          _count: client._count,
        }}
      />
    </div>
  );
}
