'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useAuthStore } from '@/hooks/useAuth';
import { ArrowLeft } from 'lucide-react';

export default function ConfiguracionPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push('/cuenta/login?redirect=/cuenta/configuracion');
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-12">
        <Link
          href="/cuenta"
          className="inline-flex items-center gap-2 text-sm text-charcoal-400 hover:text-primary-500 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <h1 className="font-display text-3xl font-light text-charcoal-700 mb-8">Configuración</h1>
        <div className="rounded-2xl border border-champagne-200 bg-white p-6 space-y-4 font-sans">
          <div>
            <p className="text-xs text-charcoal-400 uppercase tracking-wider">Nombre</p>
            <p className="text-charcoal-700 font-medium">{user.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-charcoal-400 uppercase tracking-wider">Email</p>
            <p className="text-charcoal-700 font-medium">{user.email}</p>
          </div>
          <p className="text-sm text-charcoal-400 pt-4 border-t border-champagne-100">
            Para cambiar datos o eliminar tu cuenta, escribe a{' '}
            <a href="mailto:contacto@divinittys.cl" className="text-primary-600 underline">
              contacto@divinittys.cl
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
