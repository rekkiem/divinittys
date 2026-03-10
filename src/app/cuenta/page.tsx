'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/hooks/useAuth';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { User, ShoppingBag, Heart, LogOut, Settings, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AccountPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push('/cuenta/login');
  }, [user, router]);

  if (!user) return null;

  const menuItems = [
    { href: '/cuenta/pedidos', Icon: ShoppingBag, label: 'Mis pedidos', desc: 'Historial y seguimiento' },
    { href: '/wishlist', Icon: Heart, label: 'Lista de deseos', desc: 'Productos guardados' },
    { href: '/asistente-belleza', Icon: Sparkles, label: 'Asistente IA', desc: 'LUNA · Recomendaciones' },
    { href: '/cuenta/configuracion', Icon: Settings, label: 'Configuración', desc: 'Datos personales' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Profile card */}
          <div className="bg-gradient-to-br from-primary-50 to-rose-50 rounded-3xl border border-primary-200 p-8 mb-8">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-rose-400 flex items-center justify-center text-2xl text-white font-display font-light">
                {user.name?.[0]?.toUpperCase() || <User className="w-7 h-7" />}
              </div>
              <div>
                <h1 className="font-display text-3xl font-light text-charcoal-700">¡Hola, {user.name?.split(' ')[0]}!</h1>
                <p className="font-sans text-charcoal-400 mt-1">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Menu */}
          <div className="grid grid-cols-2 gap-4">
            {menuItems.map(({ href, Icon, label, desc }) => (
              <Link key={href} href={href}>
                <div className="group p-6 rounded-2xl bg-white border border-champagne-200 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer">
                  <Icon className="w-6 h-6 text-primary-400 group-hover:text-primary-600 mb-3 transition-colors" />
                  <p className="font-sans font-bold text-charcoal-700 text-sm group-hover:text-primary-600 transition-colors">{label}</p>
                  <p className="font-sans text-xs text-charcoal-400 mt-0.5">{desc}</p>
                </div>
              </Link>
            ))}
          </div>

          <button
            onClick={() => { logout(); router.push('/'); }}
            className="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl border border-champagne-200 hover:border-rose-300 hover:text-rose-500 font-sans text-sm font-medium text-charcoal-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
