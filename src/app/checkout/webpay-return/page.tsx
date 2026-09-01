'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { useCartStore } from '@/hooks/useCart';

type ReturnStatus = 'loading' | 'success' | 'error';

export default function WebpayReturnPage() {
  const [status, setStatus] = useState<ReturnStatus>('loading');
  const [orderNumber, setOrderNumber] = useState('');
  const [message, setMessage] = useState('');
  const params = useSearchParams();
  const router = useRouter();
  const clearCart = useCartStore((s) => s.clearCart);

  const tokenWs = params?.get('token_ws');
  const tbkToken = params?.get('TBK_TOKEN');
  const tbkOrdenCompra = params?.get('TBK_ORDEN_COMPRA');
  const tbkIdSesion = params?.get('TBK_ID_SESION');

  useEffect(() => {
    const handleReturn = async () => {
      // 1. User cancelled on Webpay form ("Anular compra y volver al comercio")
      if (tbkToken) {
        setStatus('error');
        setMessage('Cancelaste el pago. Puedes intentar de nuevo cuando quieras.');
        return;
      }

      // 2. Timeout (~5 min idle on Webpay form): only session/order, no token
      if (!tokenWs && (tbkOrdenCompra || tbkIdSesion)) {
        setStatus('error');
        setMessage('La sesión de pago expiró. Puedes intentar de nuevo.');
        return;
      }

      // 3. No valid token → generic error (never call commit)
      if (!tokenWs) {
        setStatus('error');
        setMessage('El pago no se completó. Puedes intentar de nuevo.');
        return;
      }

      // 4. Normal flow: commit with Transbank
      try {
        const res = await fetch('/api/payments?action=webpay-commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_ws: tokenWs }),
        });
        const data = await res.json();

        if (data.data?.success) {
          setStatus('success');
          setOrderNumber(data.data.orderNumber ?? '');
          clearCart();
        } else {
          setStatus('error');
          setMessage(
            data.data?.message || data.error || 'El pago no pudo procesarse.'
          );
        }
      } catch {
        setStatus('error');
        setMessage('Error de conexión al confirmar el pago.');
      }
    };

    handleReturn();
  }, [tokenWs, tbkToken, tbkOrdenCompra, tbkIdSesion, clearCart]);

  return (
    <div className="min-h-screen bg-champagne-50/30">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-24 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-primary-400 animate-spin mx-auto mb-6" />
            <h1 className="font-display text-2xl text-charcoal-700">Confirmando tu pago...</h1>
            <p className="font-sans text-charcoal-400 mt-2">Por favor espera un momento.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
            <h1 className="font-display text-3xl text-charcoal-700 mb-2">¡Pago exitoso!</h1>
            <p className="font-sans text-charcoal-500 mb-2">
              Pedido: <strong>{orderNumber}</strong>
            </p>
            <p className="font-sans text-charcoal-400 mb-8">
              Recibirás un email con los detalles de tu compra.
            </p>
            <button onClick={() => router.push('/')} className="btn-primary">
              Volver al inicio
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-20 h-20 text-red-400 mx-auto mb-6" />
            <h1 className="font-display text-3xl text-charcoal-700 mb-2">Pago no completado</h1>
            <p className="font-sans text-charcoal-400 mb-8">{message}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push('/checkout')}
                className="btn-primary"
              >
                Intentarlo de nuevo
              </button>
              <button onClick={() => router.push('/')} className="btn-secondary">
                Ir al inicio
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
