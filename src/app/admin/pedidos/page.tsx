export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatCLP } from '@/lib/utils/api';
import { ShoppingBag } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING:    { label: 'Pendiente',   cls: 'bg-amber-100 text-amber-700' },
  CONFIRMED:  { label: 'Confirmado',  cls: 'bg-blue-100 text-blue-700' },
  PROCESSING: { label: 'En proceso',  cls: 'bg-purple-100 text-purple-700' },
  SHIPPED:    { label: 'Enviado',     cls: 'bg-sky-100 text-sky-700' },
  DELIVERED:  { label: 'Entregado',   cls: 'bg-emerald-100 text-emerald-700' },
  CANCELLED:  { label: 'Cancelado',   cls: 'bg-red-100 text-red-700' },
};

async function getOrders() {
  return prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { product: { select: { name: true } } } },
      payment: { select: { status: true, provider: true } },
    },
  });
}

export default async function PedidosPage() {
  const orders = await getOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-charcoal-700">Pedidos</h1>
        <p className="font-sans text-muted-foreground mt-1">{orders.length} pedidos en total</p>
      </div>

      <div className="bg-white rounded-2xl border border-champagne-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-champagne-100 bg-champagne-50/50">
                {['# Pedido', 'Cliente', 'Productos', 'Total', 'Estado', 'Pago', 'Fecha', 'Acciones'].map(h => (
                  <th key={h} className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-champagne-50">
              {orders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16">
                  <ShoppingBag className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
                  <p className="font-sans text-charcoal-400">No hay pedidos aún</p>
                </td></tr>
              ) : orders.map((order: any) => {
                const st = STATUS_LABELS[order.status] ?? { label: order.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={order.id} className="hover:bg-champagne-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-charcoal-700">{order.orderNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-sans text-sm text-charcoal-700">{order.user?.name || order.guestEmail || '—'}</p>
                      {order.user?.email && <p className="font-sans text-xs text-charcoal-400">{order.user.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-sans text-sm text-charcoal-600">{order.items.length} ítem{order.items.length !== 1 ? 's' : ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-sans font-semibold text-sm text-charcoal-700">{formatCLP(Number(order.total))}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold font-sans ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-sans text-xs ${order.payment?.status === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {order.payment?.status === 'PAID' ? '✓ Pagado' : '⏳ Pendiente'}
                        {order.payment?.provider && <span className="text-charcoal-400 ml-1">· {order.payment.provider}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-sans text-xs text-charcoal-500">
                        {new Date(order.createdAt).toLocaleDateString('es-CL')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/pedidos/${order.id}`}
                        className="font-sans text-xs text-primary-500 hover:text-primary-600 font-semibold">
                        Ver →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
