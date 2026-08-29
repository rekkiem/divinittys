'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, setToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrarse');
      setUser(data.data.user);
      setToken(data.data.accessToken);
      toast.success('¡Cuenta creada exitosamente!');
      router.push('/cuenta');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-champagne-50/30 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl border border-champagne-200 shadow-xl p-8"
      >
        <Link href="/" className="flex items-center gap-2 mb-8 group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-rose-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-2xl font-light tracking-widest text-charcoal-600">DIVINITTYS</span>
        </Link>

        <h1 className="font-display text-3xl font-light text-charcoal-700 mb-2">Crea tu cuenta</h1>
        <p className="font-sans text-charcoal-400 mb-6">Gratis · Sin suscripciones</p>

        <div className="mb-6">
          <GoogleSignInButton
            label="Registrarse con Google"
            callbackUrl="/api/oauth/google-callback"
          />
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-champagne-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-charcoal-400 font-sans tracking-wider">o con email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'name', label: 'Nombre completo', type: 'text', placeholder: 'Tu nombre' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'tu@email.com' },
            { key: 'phone', label: 'Teléfono (opcional)', type: 'tel', placeholder: '+56 9 8902 4643' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5 uppercase tracking-wider">{label}</label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                required={key !== 'phone'}
                className="input-field"
              />
            </div>
          ))}

          <div>
            <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1.5 uppercase tracking-wider">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
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
            <p className="font-sans text-xs text-charcoal-400 mt-1">Una mayúscula, una minúscula y un número</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="font-sans text-sm text-charcoal-400 text-center mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/cuenta/login" className="text-primary-500 hover:text-primary-600 font-semibold">
            Ingresar
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
