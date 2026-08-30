'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useAuthStore } from '@/hooks/useAuth';
import { formatCLP } from '@/lib/utils/api';
import { ArrowLeft, Package, X, ChevronRight, MapPin, CreditCard } from 'lucide-react';

type OrderItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number | string;
  image?: string | null;
  product?: {
    images?: { url: string }[];
  } | null;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal?: number | string;
  shippingAmount?: number | string;
  discountAmount?: number | string;
  total: number | string;
  createdAt: string;
  shippingData?: {
    firstName?: string;
    lastName?: string;
    street?: string;
    number?: string;
    apartment?: string;
    commune?: string;
    city?: string;
    region?: string;
    phone?: string;
    email?: string;
  } | null;
  items?: OrderItem[];
  payment?: {
    status?: string;
    provider?: string;
    paidAt?: string | null;
    paymentMethod?: string | null;
  } | null;
  shipment?: {
    trackingNumber?: string | null;
    status?: string | null;
  } | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'En preparaci\u00f3n',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const PAY_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  PAID: 'Pagado',
  FAILED: 'Fallido',
  REFUNDED: 'Reembolsado',
};

function statusBadgeClass(status: string) {
  switch (status) {
    case 'DELIVERED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'SHIPPED':
    case 'CONFIRMED':
    case 'PROCESSING':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'CANCELLED':
      return 'bg-red-50 text-red-600 border-red-200';
    default:
      return 'bg-champagne-50 text-charcoal-500 border-champagne-200';
  }
}

function payBadgeClass(status: string) {
  if (status === 'PAID') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'FAILED' || status === 'REFUNDED') return 'bg-red-50 text-red-600 border-red-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function itemImage(item: OrderItem): string | null {
  return item.image || item.product?.images?.[0]?.url || null;
}

export default function PedidosPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrderRow | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/cuenta/login?redirect=/cuenta/pedidos');
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/orders', { credentials: 'include' });
        const data = await res.json();
        setOrders(data.data?.orders || []);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  useEffect(() => {
    if (selected) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selected]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <Link
          href="/cuenta"
          className="inline-flex items-center gap-2 text-sm text-charcoal-400 hover:text-primary-500 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a mi cuenta
        </Link>
        <h1 className="font-display text-3xl font-light text-charcoal-700 mb-2">Mis pedidos</h1>
        <p className="font-sans text-sm text-charcoal-400 mb-8">
          Revis\u00e1 el detalle y el estado de tus compras
        </p>

        {loading && <p className="text-charcoal-400 font-sans">Cargando\u2026</p>}

        {!loading && orders.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-champagne-200 bg-white">
            <Package className="w-12 h-12 text-champagne-300 mx-auto mb-4" />
            <p className="font-sans text-charcoal-500 mb-4">A\u00fan no tienes pedidos</p>
            <Link href="/productos" className="btn-primary">
              Ir al cat\u00e1logo
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {orders.map((o) => {
            const itemCount = o.items?.reduce((n, i) => n + i.quantity, 0) ?? 0;
            const firstImg = o.items?.[0] ? itemImage(o.items[0]) : null;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelected(o)}
                className="w-full text-left p-4 sm:p-5 rounded-2xl border border-champagne-200 bg-white hover:border-primary-300 hover:shadow-md transition-all flex items-center gap-4 group"
              >
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-champagne-50 shrink-0 border border-champagne-100">
                  {firstImg ? (
                    <Image src={firstImg} alt="" fill className="object-cover" sizes="64px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-champagne-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-sans font-semibold text-charcoal-700 text-sm sm:text-base">
                      {o.orderNumber}
                    </span>
                    <span
                      className={`text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full border ${statusBadgeClass(o.status)}`}
                    >
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                    <span
                      className={`text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full border ${payBadgeClass(o.paymentStatus)}`}
                    >
                      {PAY_LABEL[o.paymentStatus] || o.paymentStatus}
                    </span>
                  </div>
                  <p className="font-sans text-xs text-charcoal-400">
                    {new Date(o.createdAt).toLocaleDateString('es-CL', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                    {itemCount > 0 && (
                      <span>
                        {' '}\n                        \u00b7 {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="font-sans font-bold text-primary-600 text-sm sm:text-base">
                    {formatCLP(Number(o.total))}
                  </p>
                  <ChevronRight className="w-5 h-5 text-champagne-300 group-hover:text-primary-400 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      </main>
      <Footer />

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-charcoal-900/50 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-champagne-100">
              <div>
                <p className="font-sans text-xs text-charcoal-400 mb-0.5">Detalle de la compra</p>
                <h2 id="order-detail-title" className="font-display text-xl text-charcoal-700">
                  {selected.orderNumber}
                </h2>
                <p className="font-sans text-xs text-charcoal-400 mt-1">
                  {new Date(selected.createdAt).toLocaleDateString('es-CL', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-2 rounded-full hover:bg-champagne-50 text-charcoal-400 hover:text-charcoal-700 transition-colors"
                aria-label="Cerrar detalle"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusBadgeClass(selected.status)}`}
                >
                  {STATUS_LABEL[selected.status] || selected.status}
                </span>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${payBadgeClass(selected.paymentStatus)}`}
                >
                  Pago: {PAY_LABEL[selected.paymentStatus] || selected.paymentStatus}
                </span>
                {selected.payment?.provider && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full border border-champagne-200 text-charcoal-500 bg-champagne-50">
                    {selected.payment.provider === 'MERCADOPAGO' ? 'MercadoPago' : selected.payment.provider}
                  </span>
                )}
              </div>

              <section>
                <h3 className="font-sans text-sm font-semibold text-charcoal-600 mb-3">
                  Productos ({selected.items?.length ?? 0})
                </h3>
                <ul className="space-y-3">
                  {(selected.items || []).map((item) => {
                    const img = itemImage(item);
                    return (
                      <li
                        key={item.id}
                        className="flex gap-3 p-3 rounded-xl border border-champagne-100 bg-champagne-50/40"
                      >
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-white border border-champagne-100 shrink-0">
                          {img ? (
                            <Image src={img} alt={item.name} fill className="object-cover" sizes="56px" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 text-champagne-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-sans text-sm font-medium text-charcoal-700 line-clamp-2">
                            {item.name}
                          </p>
                          <p className="font-sans text-xs text-charcoal-400 mt-0.5">
                            {item.quantity} u. \u00b7 {formatCLP(Number(item.price))} c/u
                          </p>
                        </div>
                        <p className="font-sans text-sm font-semibold text-charcoal-700 shrink-0">
                          {formatCLP(Number(item.price) * item.quantity)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="rounded-xl border border-champagne-100 p-4 space-y-2">
                <div className="flex justify-between text-sm font-sans text-charcoal-500">
                  <span>Subtotal</span>
                  <span>{formatCLP(Number(selected.subtotal ?? selected.total))}</span>
                </div>
                {Number(selected.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-sm font-sans text-emerald-600">
                    <span>Descuento</span>
                    <span>-{formatCLP(Number(selected.discountAmount))}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-sans text-charcoal-500">
                  <span>Env\u00edo</span>
                  <span>
                    {Number(selected.shippingAmount || 0) === 0
                      ? 'Gratis'
                      : formatCLP(Number(selected.shippingAmount || 0))}
                  </span>
                </div>
                <div className="flex justify-between text-base font-sans font-bold text-charcoal-700 pt-2 border-t border-champagne-100">
                  <span>Total</span>
                  <span className="text-primary-600">{formatCLP(Number(selected.total))}</span>
                </div>
              </section>

              {selected.shippingData && (
                <section className="rounded-xl border border-champagne-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-primary-500" />
                    <h3 className="font-sans text-sm font-semibold text-charcoal-600">Direcci\u00f3n de env\u00edo</h3>
                  </div>
                  <p className="font-sans text-sm text-charcoal-600">
                    {[selected.shippingData.firstName, selected.shippingData.lastName]
                      .filter(Boolean)
                      .join(' ')}
                  </p>
                  <p className="font-sans text-sm text-charcoal-500">
                    {[selected.shippingData.street, selected.shippingData.number]
                      .filter(Boolean)
                      .join(' ')}
                    {selected.shippingData.apartment ? `, ${selected.shippingData.apartment}` : ''}
                  </p>
                  <p className="font-sans text-sm text-charcoal-500">
                    {[selected.shippingData.commune, selected.shippingData.city, selected.shippingData.region]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {selected.shipment?.trackingNumber && (
                    <p className="font-sans text-xs text-charcoal-400 mt-2">
                      Seguimiento: {selected.shipment.trackingNumber}
                    </p>
                  )}
                </section>
              )}

              {selected.payment && (
                <section className="rounded-xl border border-champagne-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-4 h-4 text-primary-500" />
                    <h3 className="font-sans text-sm font-semibold text-charcoal-600">Pago</h3>
                  </div>
                  <p className="font-sans text-sm text-charcoal-500">
                    {selected.payment.provider === 'MERCADOPAGO'
                      ? 'MercadoPago'
                      : selected.payment.provider || '\u2014'}
                    {selected.payment.paymentMethod ? ` \u00b7 ${selected.payment.paymentMethod}` : ''}
                  </p>
                  {selected.payment.paidAt && (
                    <p className="font-sans text-xs text-charcoal-400 mt-1">
                      Pagado el{' '}
                      {new Date(selected.payment.paidAt).toLocaleDateString('es-CL', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </section>
              )}
            </div>

            <div className="px-5 py-4 border-t border-champagne-100 bg-white">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-full btn-secondary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
