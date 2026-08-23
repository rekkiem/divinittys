'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useAuthStore } from '@/hooks/useAuth';
import { formatCLP } from '@/lib/utils/api';
import { ArrowLeft, Package } from 'lucide-react';

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number | string;
  createdAt: string;
};

export default function PedidosPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

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
        <h1 className="font-display text-3xl font-light text-charcoal-700 mb-8">Mis pedidos</h1>

        {loading && <p className="text-charcoal-400 font-sans">Cargando…</p>}

        {!loading && orders.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-champagne-200 bg-white">
            <Package className="w-12 h-12 text-champagne-300 mx-auto mb-4" />
            <p className="font-sans text-charcoal-500 mb-4">Aún no tienes pedidos</p>
            <Link href="/productos" className="btn-primary">
              Ir al catálogo
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="p-5 rounded-2xl border border-champagne-200 bg-white flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-sans font-semibold text-charcoal-700">{o.orderNumber}</p>
                <p className="font-sans text-xs text-charcoal-400 mt-1">
                  {new Date(o.createdAt).toLocaleDateString('es-CL')} · {o.status} · pago{' '}
                  {o.paymentStatus}
                </p>
              </div>
              <p className="font-sans font-bold text-primary-600">{formatCLP(Number(o.total))}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
