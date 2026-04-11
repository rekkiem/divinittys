export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { Users } from 'lucide-react';

async function getClients() {
  return prisma.user.findMany({
    where: { role: 'CUSTOMER' },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, name: true, email: true, phone: true,
      isActive: true, createdAt: true,
      _count: { select: { orders: true } },
    },
  });
}

export default async function ClientesPage() {
  const clients = await getClients();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-charcoal-700">Clientes</h1>
        <p className="font-sans text-muted-foreground mt-1">{clients.length} clientes registrados</p>
      </div>

      <div className="bg-white rounded-2xl border border-champagne-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-champagne-100 bg-champagne-50/50">
                {['Cliente', 'Email', 'Teléfono', 'Pedidos', 'Registro', 'Estado'].map(h => (
                  <th key={h} className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-champagne-50">
              {clients.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16">
                  <Users className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
                  <p className="font-sans text-charcoal-400">No hay clientes aún</p>
                </td></tr>
              ) : clients.map((c: any) => (
                <tr key={c.id} className="hover:bg-champagne-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-sans font-medium text-sm text-charcoal-700">{c.name || '—'}</p>
                  </td>
                  <td className="px-4 py-3"><span className="font-sans text-sm text-charcoal-600">{c.email}</span></td>
                  <td className="px-4 py-3"><span className="font-sans text-sm text-charcoal-500">{c.phone || '—'}</span></td>
                  <td className="px-4 py-3">
                    <span className="font-sans text-sm font-semibold text-primary-600">{c._count.orders}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-sans text-xs text-charcoal-400">
                      {new Date(c.createdAt).toLocaleDateString('es-CL')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold font-sans ${c.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      {c.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
