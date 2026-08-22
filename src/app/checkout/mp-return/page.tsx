'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { useCartStore } from '@/hooks/useCart';

export default function MPReturnPage() {
  const params = useSearchParams();
  const router = useRouter();
  const status = params?.get('status');
  const clearCart = useCartStore((s) => s.clearCart);

  // Solo vaciar carrito cuando el pago está confirmado exitosamente
  useEffect(() => {
    if (status === 'success') {
      clearCart();
    }
  }, [status, clearCart]);

  const config =
    {
      success: {
        icon: CheckCircle2,
        color: 'text-emerald-500',
        title: '¡Pago exitoso!',
        msg: 'Tu pago fue procesado correctamente.',
      },
      failure: {
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
    }[status || 'pending'] || {
      icon: Clock,
      color: 'text-amber-500',
      title: 'Procesando...',
      msg: '',
    };

  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-champagne-50/30">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-24 text-center">
        <Icon className={`w-20 h-20 ${config.color} mx-auto mb-6`} />
        <h1 className="font-display text-3xl text-charcoal-700 mb-2">{config.title}</h1>
        <p className="font-sans text-charcoal-400 mb-8">{config.msg}</p>
        <div className="flex gap-3 justify-center">
          {status !== 'success' && (
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
