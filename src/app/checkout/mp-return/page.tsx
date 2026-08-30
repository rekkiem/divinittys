'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { useCartStore } from '@/hooks/useCart';

export default function MPReturnPage() {
  const params = useSearchParams();
  const router = useRouter();
  const clearCart = useCartStore((s) => s.clearCart);

  const statusParam = params?.get('status') || params?.get('collection_status') || 'pending';
  const orderId = params?.get('orderId') || undefined;
  const paymentId =
    params?.get('payment_id') ||
    params?.get('collection_id') ||
    params?.get('paymentId') ||
    undefined;

  const [confirmState, setConfirmState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  // Confirmar pago en backend (no depender solo del webhook) y vaciar carrito si aplica
  useEffect(() => {
    const isSuccess =
      statusParam === 'success' ||
      statusParam === 'approved';

    if (isSuccess) {
      clearCart();
    }

    if (!paymentId || !isSuccess) return;

    let cancelled = false;
    setConfirmState('loading');

    fetch('/api/payments?action=mp-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, orderId }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setConfirmState('error');
          return;
        }
        const data = await res.json().catch(() => ({}));
        setConfirmState(data?.data?.success || data?.success ? 'ok' : 'error');
      })
      .catch(() => {
        if (!cancelled) setConfirmState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [statusParam, paymentId, orderId, clearCart]);

  const config =
    {
      success: {
        icon: CheckCircle2,
        color: 'text-emerald-500',
        title: '¡Pago exitoso!',
        msg:
          confirmState === 'loading'
            ? 'Confirmando tu pago con el servidor…'
            : confirmState === 'error'
              ? 'Tu pago fue aprobado en Mercado Pago. Si el pedido no aparece como pagado en unos minutos, contacta soporte.'
              : 'Tu pago fue procesado correctamente.',
      },
      approved: {
        icon: CheckCircle2,
        color: 'text-emerald-500',
        title: '¡Pago exitoso!',
        msg:
          confirmState === 'loading'
            ? 'Confirmando tu pago con el servidor…'
            : 'Tu pago fue procesado correctamente.',
      },
      failure: {
        icon: XCircle,
        color: 'text-red-400',
        title: 'Pago rechazado',
        msg: 'No se pudo procesar tu pago. Intenta con otro método.',
      },
      rejected: {
        icon: XCircle,
        color: 'text-red-400',
        title: 'Pago rechazado',
        msg: 'No se pudo procesar tu pago. Intenta con otro método.',
      },
      pending: {
        icon: Clock,
        color: 'text-amber-500',
        title: 'Pago en proceso',
        msg: 'Tu pago está siendo procesado. Te notificaremos por email.',
      },
    }[statusParam || 'pending'] || {
      icon: Clock,
      color: 'text-amber-500',
      title: 'Procesando...',
      msg: '',
    };

  const Icon = config.icon;
  const showRetry = !['success', 'approved'].includes(statusParam || '');

  return (
    <div className="min-h-screen bg-champagne-50/30">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-24 text-center">
        <Icon className={`w-20 h-20 ${config.color} mx-auto mb-6`} />
        <h1 className="font-display text-3xl text-charcoal-700 mb-2">{config.title}</h1>
        <p className="font-sans text-charcoal-400 mb-8">{config.msg}</p>
        <div className="flex gap-3 justify-center">
          {showRetry && (
            <button onClick={() => router.push('/checkout')} className="btn-primary">
              Intentarlo de nuevo
            </button>
          )}
          <button onClick={() => router.push('/')} className="btn-secondary">
            Ir al inicio
          </button>
        </div>
      </main>
    </div>
  );
}
