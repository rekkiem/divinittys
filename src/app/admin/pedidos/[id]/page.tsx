import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatCLP } from '@/lib/utils/api';
import { ArrowLeft } from 'lucide-react';
import OrderStatusClient from './OrderStatusClient';

async function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          product: {
            select: { name: true, slug: true, images: { where: { isMain: true }, take: 1 } },
          },
        },
      },
      payment: true,
      shipment: true,
    },
  });
}

export default async function PedidoDetailPage({ params }: { params: { id: string } }) {
  const order = await getOrder(params.id);
  if (!order) notFound();

  const shipping = order.shippingData as any;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/pedidos" className="p-2 rounded-lg hover:bg-muted transition-colors text-charcoal-400">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-medium text-charcoal-700">Pedido {order.orderNumber}</h1>
          <p className="font-sans text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString('es-CL', { dateStyle: 'full' })}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Items */}
          <div className="bg-white rounded-2xl border border-champagne-100 p-6">
            <h2 className="font-sans font-semibold text-charcoal-700 mb-4">Productos</h2>
            <div className="space-y-3">
              {(order.items as any[]).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3 border-b border-champagne-50 last:border-0">
                  <div>
                    <p className="font-sans font-medium text-sm text-charcoal-700">{item.name}</p>
                    <p className="font-sans text-xs text-charcoal-400">Cant: {item.quantity} × {formatCLP(Number(item.price))}</p>
                  </div>
                  <span className="font-sans font-semibold text-sm">{formatCLP(Number(item.total))}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-champagne-100 space-y-1">
              <div className="flex justify-between font-sans text-sm">
                <span className="text-charcoal-500">Subtotal</span>
                <span>{formatCLP(Number(order.subtotal))}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between font-sans text-sm text-emerald-600">
                  <span>Descuento</span>
                  <span>-{formatCLP(Number(order.discountAmount))}</span>
                </div>
              )}
              <div className="flex justify-between font-sans text-sm">
                <span className="text-charcoal-500">Envío</span>
                <span>{Number(order.shippingAmount) === 0 ? 'Gratis' : formatCLP(Number(order.shippingAmount))}</span>
              </div>
              <div className="flex justify-between font-sans font-bold text-base pt-2 border-t border-champagne-100">
                <span>Total</span>
                <span className="text-primary-600">{formatCLP(Number(order.total))}</span>
              </div>
            </div>
          </div>

          {/* Shipping address */}
          {shipping && (
            <div className="bg-white rounded-2xl border border-champagne-100 p-6">
              <h2 className="font-sans font-semibold text-charcoal-700 mb-3">Dirección de envío</h2>
              <div className="font-sans text-sm text-charcoal-600 space-y-1">
                <p className="font-medium">{shipping.name} {shipping.lastName}</p>
                <p>{shipping.address}, {shipping.commune}</p>
                <p>{shipping.city}, {shipping.region}</p>
                <p>{shipping.email} · {shipping.phone}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <OrderStatusClient orderId={order.id} currentStatus={order.status} />

          {/* Payment */}
          <div className="bg-white rounded-2xl border border-champagne-100 p-6">
            <h2 className="font-sans font-semibold text-charcoal-700 mb-3">Pago</h2>
            <div className="font-sans text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-charcoal-500">Estado</span>
                <span className={order.payment?.status === 'PAID' ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                  {order.payment?.status ?? 'Sin pago'}
                </span>
              </div>
              {order.payment?.provider && (
                <div className="flex justify-between">
                  <span className="text-charcoal-500">Método</span>
                  <span>{order.payment.provider}</span>
                </div>
              )}
              {order.payment?.authCode && (
                <div className="flex justify-between">
                  <span className="text-charcoal-500">Cód. auth</span>
                  <span className="font-mono text-xs">{order.payment.authCode}</span>
                </div>
              )}
            </div>
          </div>

          {/* Customer */}
          <div className="bg-white rounded-2xl border border-champagne-100 p-6">
            <h2 className="font-sans font-semibold text-charcoal-700 mb-3">Cliente</h2>
            <div className="font-sans text-sm text-charcoal-600 space-y-1">
              <p className="font-medium">{order.user?.name || 'Invitado'}</p>
              <p className="text-charcoal-400">{order.user?.email || order.guestEmail}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
