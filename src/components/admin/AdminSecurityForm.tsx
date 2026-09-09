'use client';

import { useState } from 'react';
import { Lock, Loader2, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/hooks/useAuth';

export default function AdminSecurityForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const { accessToken, logout } = useAuthStore();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setSaving(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch('/api/admin/me/password', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar contraseña');

      toast.success('Contraseña actualizada. Debes iniciar sesión de nuevo.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Cerrar sesión local y redirigir
      setTimeout(() => {
        if (typeof logout === 'function') logout();
        window.location.href = '/cuenta/login';
      }, 1200);
    } catch (err: any) {
      toast.error(err?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = 'input-field text-sm';
  const labelCls =
    'block font-sans text-xs font-semibold text-charcoal-500 mb-1.5 uppercase tracking-wider';

  return (
    <div className="bg-white rounded-2xl border border-champagne-100 p-6">
      <div className="flex items-center gap-2 mb-5">
        <Shield className="w-4 h-4 text-primary-500" />
        <h2 className="font-sans font-semibold text-charcoal-700">Seguridad de la cuenta</h2>
      </div>
      <p className="font-sans text-sm text-charcoal-500 mb-5">
        Cambia tu contraseña de administrador. Tras el cambio se cerrarán todas las sesiones
        activas y deberás volver a iniciar sesión.
      </p>

      <form onSubmit={submit} className="space-y-4 max-w-md">
        <div>
          <label className={labelCls}>Contraseña actual</label>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={fieldCls}
            required
          />
        </div>
        <div>
          <label className={labelCls}>Nueva contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={fieldCls}
            minLength={8}
            required
          />
        </div>
        <div>
          <label className={labelCls}>Confirmar nueva contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={fieldCls}
            minLength={8}
            required
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="btn-primary flex items-center gap-2 text-sm py-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          {saving ? 'Actualizando…' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  );
}
