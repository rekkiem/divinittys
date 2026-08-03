'use client';

import Navbar from '@/components/layout/Navbar';
import CheckoutForm from '@/components/shop/CheckoutForm';

export const metadata = {
  title: 'Checkout | DIVINITTYS',
};

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-champagne-50/30">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="section-title mb-10">Finalizar compra</h1>
        <CheckoutForm />
      </main>
    </div>
  );
}
