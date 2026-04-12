'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Truck, CreditCard, MapPin, User, Loader2, ShieldCheck } from 'lucide-react';
import { useCartStore } from '@/hooks/useCart';
import { formatCLP } from '@/lib/utils/api';
import toast from 'react-hot-toast';

type ShippingQuote = {
  price: number;
  days: number;
  service: string;
};

export default function CheckoutForm() {
  const router = useRouter();
  const { items, total, clearCart } = useCartStore();
  const [step, setStep] = useState<'contact' | 'shipping' | 'payment'>('contact');
  const [loading, setLoading] = useState(false);
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'WEBPAY' | 'MERCADOPAGO'>('WEBPAY');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    street: '',
    number: '',
    apartment: '',
    commune: '',
    city: '',
    region: '',
    postalCode: '',
  });

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const splitName = (fullName: string) => {
    const trimmed = fullName.trim();
    if (!trimmed) return { firstName: '', lastName: '' };

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '-' };
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  };

  const quoteShipping = async () => {
    if (!form.commune || !form.region) {
      toast.error('Ingresa tu dirección primero');
      return;
    }
    setQuoting(true);
    try {
      const res = await fetch('/api/shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'quote',
          destination: { commune: form.commune, region: form.region },
          weight: items.reduce((s, _) => s + 0.5, 0),
        }),
      });
      const data = await res.json();
      setShippingQuote(data.data || { price: 4990, days: 3, service: 'Bluexpress Estándar' });
    } catch {
      setShippingQuote({ price: 4990, days: 3, service: 'Bluexpress Estándar' });
    } finally {
      setQuoting(false);
    }
  };

  const placeOrder = async () => {
    setLoading(true);
    try {
      const { firstName, lastName } = splitName(form.name);
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.id,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
          shippingData: {
            firstName,
            lastName,
            street: form.street,
            number: form.number,
            apartment: form.apartment,
            commune: form.commune,
            city: form.city,
            region: form.region,
            phone: form.phone,
            email: form.email,
          },
        }),
      });
      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        throw new Error(orderData.error || 'No se pudo crear el pedido');
      }

      const orderId = orderData.data?.order?.id;

      if (!orderId) throw new Error('Order creation failed');

      // Determine correct action by payment method
      const action = paymentMethod === 'MERCADOPAGO' ? 'mp-preference' : 'webpay-init';
      const payRes = await fetch(`/api/payments?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId }),
      });
      const payData = await payRes.json();

      if (!payRes.ok) {
        throw new Error(payData.error || 'Error al iniciar el pago');
      }

      if (paymentMethod === 'WEBPAY' && payData.data?.url) {
        clearCart();
        // Webpay requires form POST, not redirect
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = payData.data.url;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'token_ws';
        input.value = payData.data.token;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
      } else if (paymentMethod === 'MERCADOPAGO' && (payData.data?.init_point || payData.data?.sandboxInitPoint)) {
        clearCart();
        window.location.href = payData.data.init_point || payData.data.sandboxInitPoint;
      } else {
        throw new Error('No se pudo iniciar el pago. Verifique que el pedido se creó correctamente.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error al procesar el pago. Por favor intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="font-display text-3xl font-light text-charcoal-400 mb-4">Tu carrito está vacío</p>
        <button onClick={() => router.push('/productos')} className="btn-primary">
          Ir a productos
        </button>
      </div>
    );
  }

  const subtotal = total();
  const shipping = shippingQuote?.price || 0;
  const orderTotal = subtotal + shipping;

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Contact */}
        <div className="bg-white rounded-2xl border border-champagne-200 p-6">
          <h3 className="font-sans font-bold text-charcoal-700 mb-5 flex items-center gap-2">
            <User className="w-4 h-4 text-primary-500" />
            Información de contacto
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5">Nombre completo</label>
              <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Tu nombre" className="input-field" />
            </div>
            <div>
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="email@ejemplo.com" className="input-field" />
            </div>
            <div>
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5">Teléfono</label>
              <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+56 9 1234 5678" className="input-field" />
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white rounded-2xl border border-champagne-200 p-6">
          <h3 className="font-sans font-bold text-charcoal-700 mb-5 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary-500" />
            Dirección de entrega
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5">Calle / Avenida</label>
              <input value={form.street} onChange={(e) => update('street', e.target.value)} placeholder="Av. Providencia" className="input-field" />
            </div>
            <div>
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5">Número</label>
              <input value={form.number} onChange={(e) => update('number', e.target.value)} placeholder="123" className="input-field" />
            </div>
            <div>
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5">Depto/Casa (opcional)</label>
              <input value={form.apartment} onChange={(e) => update('apartment', e.target.value)} placeholder="Depto 4B" className="input-field" />
            </div>
            <div>
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5">Comuna</label>
              <input value={form.commune} onChange={(e) => update('commune', e.target.value)} placeholder="Providencia" className="input-field" />
            </div>
            <div>
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5">Ciudad</label>
              <input value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Santiago" className="input-field" />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5">Región</label>
              <select value={form.region} onChange={(e) => update('region', e.target.value)} className="input-field">
                <option value="">Selecciona tu región</option>
                {['Metropolitana', 'Valparaíso', 'Biobío', 'La Araucanía', 'Los Lagos', 'Coquimbo', 'Maule', "O'Higgins", 'Atacama', 'Antofagasta', 'Tarapacá', 'Aysén', 'Magallanes', 'Los Ríos', 'Arica y Parinacota', 'Ñuble'].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Shipping quote */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={quoteShipping}
              disabled={quoting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary-300 text-primary-600 hover:bg-primary-50 font-sans text-sm font-semibold transition-colors"
            >
              {quoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Cotizar envío
            </button>
            {shippingQuote && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-sm font-sans text-green-600 bg-green-50 px-3 py-2 rounded-xl border border-green-200"
              >
                <Truck className="w-4 h-4" />
                {shippingQuote.service} · {shippingQuote.days} días · {formatCLP(shippingQuote.price)}
              </motion.div>
            )}
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-2xl border border-champagne-200 p-6">
          <h3 className="font-sans font-bold text-charcoal-700 mb-5 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary-500" />
            Método de pago
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { id: 'WEBPAY', label: 'Webpay Plus', sub: 'Transbank · Débito/Crédito/Cuotas', badge: 'Recomendado' },
              { id: 'MERCADOPAGO', label: 'MercadoPago', sub: 'Débito/Crédito/Transferencia', badge: '' },
            ].map((method) => (
              <button
                key={method.id}
                onClick={() => setPaymentMethod(method.id as any)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  paymentMethod === method.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-champagne-200 hover:border-primary-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                    paymentMethod === method.id ? 'border-primary-500' : 'border-charcoal-300'
                  }`}>
                    {paymentMethod === method.id && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                  </div>
                  {method.badge && (
                    <span className="badge bg-primary-100 text-primary-600">{method.badge}</span>
                  )}
                </div>
                <p className="font-sans font-bold text-charcoal-700 text-sm mt-2">{method.label}</p>
                <p className="font-sans text-xs text-charcoal-400">{method.sub}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-green-50 border border-green-200">
            <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
            <p className="font-sans text-xs text-green-700">
              Tu pago está 100% protegido. Usamos encriptación SSL de 256 bits.
            </p>
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="lg:col-span-1">
        <div className="sticky top-24 bg-white rounded-2xl border border-champagne-200 p-6 space-y-5">
          <h3 className="font-sans font-bold text-charcoal-700">Resumen del pedido</h3>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-champagne-100 overflow-hidden shrink-0">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} width={48} height={48} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="font-display text-lg text-primary-300">D</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-xs font-medium text-charcoal-700 line-clamp-2">{item.name}</p>
                  <p className="font-sans text-xs text-charcoal-400">x{item.quantity}</p>
                </div>
                <span className="font-sans text-xs font-bold text-charcoal-700 shrink-0">
                  {formatCLP(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-champagne-100 pt-4 space-y-2">
            <div className="flex justify-between font-sans text-sm text-charcoal-500">
              <span>Subtotal</span>
              <span>{formatCLP(subtotal)}</span>
            </div>
            <div className="flex justify-between font-sans text-sm text-charcoal-500">
              <span>Envío</span>
              <span>{shipping > 0 ? formatCLP(shipping) : 'Por calcular'}</span>
            </div>
            <div className="flex justify-between font-sans font-bold text-charcoal-700 text-lg border-t border-champagne-100 pt-2">
              <span>Total</span>
              <span className="text-primary-600">{formatCLP(orderTotal)}</span>
            </div>
          </div>

          <button
            onClick={placeOrder}
            disabled={loading || !form.name || !form.email || !form.street}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Pagar {formatCLP(orderTotal)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
