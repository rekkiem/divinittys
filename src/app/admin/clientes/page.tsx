export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { Users } from 'lucide-react';
import Link from 'next/link';
import ClientesTableClient from './ClientesTableClient';

async function getClients() {
  return prisma.user.findMany({
    where: { role: 'CUSTOMER' },
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      _count: { select: { orders: true, addresses: true } },
    },
  });
}

export default async function ClientesPage() {
  const clients = await getClients();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-charcoal-700">Clientes</h1>
          <p className="font-sans text-muted-foreground mt-1">{clients.length} clientes registrados</p>
        </div>
      </div>

      <ClientesTableClient initialClients={clients} />
    </div>
  );
}
