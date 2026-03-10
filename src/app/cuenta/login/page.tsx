'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
      setUser(data.data.user);
      setToken(data.data.accessToken);
      toast.success('¡Bienvenida de vuelta!');
      router.push('/cuenta');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Link href="/" className="flex items-center gap-2 mb-10 group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-rose-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-2xl font-light tracking-widest text-charcoal-600">DIVINITTYS</span>
          </Link>

          <h1 className="font-display text-4xl font-light text-charcoal-700 mb-2">Bienvenida</h1>
          <p className="font-sans text-charcoal-400 mb-8">Ingresa a tu cuenta para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="tu@email.com"
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5 uppercase tracking-wider">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="input-field pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="font-sans text-sm text-charcoal-400">
              ¿No tienes cuenta?{' '}
              <Link href="/cuenta/registro" className="text-primary-500 hover:text-primary-600 font-semibold">
                Crear una cuenta gratis
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Right: Visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-400 via-primary-500 to-rose-400 items-center justify-center p-12">
        <div className="text-center text-white max-w-sm">
          <Sparkles className="w-16 h-16 mx-auto mb-6 opacity-80" />
          <h2 className="font-display text-4xl font-light mb-4">Tu mundo de belleza</h2>
          <p className="font-sans text-white/70 leading-relaxed">
            Accede a tu historial de compras, lista de deseos y recomendaciones personalizadas.
          </p>
        </div>
      </div>
    </div>
  );
}
