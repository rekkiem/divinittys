'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useAuthStore } from '@/hooks/useAuth';
import { CHILE_REGIONS } from '@/lib/chile/geo';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Star,
  LogOut,
  User,
  Package,
  AlertTriangle,
  Check,
  X,
  Home,
} from 'lucide-react';

type Address = {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  street: string;
  number: string;
  apartment?: string | null;
  commune: string;
  city: string;
  region: string;
  postalCode?: string | null;
  phone?: string | null;
  isDefault: boolean;
};

type Profile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar: string | null;
  isActive: boolean;
  _count?: { addresses: number; orders: number };
};

const emptyAddressForm = {
  label: 'Casa',
  firstName: '',
  lastName: '',
  street: '',
  number: '',
  apartment: '',
  commune: '',
  city: '',
  region: '',
  postalCode: '',
  phone: '',
  isDefault: true,
};

export default function ConfiguracionPage() {
  const { user, accessToken, setUser, logout } = useAuthStore();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressMsg, setAddressMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateErr, setDeactivateErr] = useState<string | null>(null);

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) h.Authorization = `Bearer ${accessToken}`;
    return h;
  }, [accessToken]);

  const communes = useMemo(() => {
    const region = CHILE_REGIONS.find((r) => r.name === addressForm.region);
    return region?.communes ?? [];
  }, [addressForm.region]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([
        fetch('/api/account/profile', { headers: authHeaders, credentials: 'include' }),
        fetch('/api/account/addresses', { headers: authHeaders, credentials: 'include' }),
      ]);
      const pJson = await pRes.json();
      const aJson = await aRes.json();
      if (pJson.success && pJson.data?.user) {
        setProfile(pJson.data.user);
        setProfileForm({
          name: pJson.data.user.name || '',
          phone: pJson.data.user.phone || '',
        });
      }
      if (aJson.success) {
        setAddresses(aJson.data?.addresses || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user, authHeaders]);

  useEffect(() => {
    if (!user) {
      router.push('/cuenta/login?redirect=/cuenta/configuracion');
      return;
    }
    loadData();
  }, [user, router, loadData]);

  if (!user) return null;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          name: profileForm.name.trim(),
          phone: profileForm.phone.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setProfileMsg({ type: 'err', text: json.error || 'No se pudo guardar' });
        return;
      }
      setProfile((prev) => (prev ? { ...prev, ...json.data.user } : json.data.user));
      setUser({
        id: json.data.user.id,
        email: json.data.user.email,
        name: json.data.user.name,
        role: json.data.user.role,
        avatar: json.data.user.avatar,
      });
      setProfileMsg({ type: 'ok', text: 'Perfil actualizado' });
    } catch {
      setProfileMsg({ type: 'err', text: 'Error de red' });
    } finally {
      setSavingProfile(false);
    }
  };

  const openNewAddress = () => {
    setEditingId(null);
    setAddressForm({
      ...emptyAddressForm,
      firstName: (profile?.name || user.name || '').split(' ')[0] || '',
      lastName: (profile?.name || user.name || '').split(' ').slice(1).join(' ') || '',
      phone: profile?.phone || '',
      isDefault: addresses.length === 0,
    });
    setShowAddressForm(true);
    setAddressMsg(null);
  };

  const openEditAddress = (a: Address) => {
    setEditingId(a.id);
    setAddressForm({
      label: a.label || 'Casa',
      firstName: a.firstName,
      lastName: a.lastName,
      street: a.street,
      number: a.number,
      apartment: a.apartment || '',
      commune: a.commune,
      city: a.city,
      region: a.region,
      postalCode: a.postalCode || '',
      phone: a.phone || '',
      isDefault: a.isDefault,
    });
    setShowAddressForm(true);
    setAddressMsg(null);
  };

  const saveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddress(true);
    setAddressMsg(null);
    const payload = {
      label: addressForm.label.trim() || 'Casa',
      firstName: addressForm.firstName.trim(),
      lastName: addressForm.lastName.trim(),
      street: addressForm.street.trim(),
      number: addressForm.number.trim(),
      apartment: addressForm.apartment.trim() || null,
      commune: addressForm.commune,
      city: addressForm.city.trim() || addressForm.commune,
      region: addressForm.region,
      postalCode: addressForm.postalCode.trim() || null,
      phone: addressForm.phone.trim() || null,
      isDefault: addressForm.isDefault,
    };
    try {
      const url = editingId
        ? `/api/account/addresses/${editingId}`
        : '/api/account/addresses';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setAddressMsg({ type: 'err', text: json.error || 'No se pudo guardar la dirección' });
        return;
      }
      setShowAddressForm(false);
      setEditingId(null);
      await loadData();
      setAddressMsg({ type: 'ok', text: editingId ? 'Dirección actualizada' : 'Dirección agregada' });
    } catch {
      setAddressMsg({ type: 'err', text: 'Error de red' });
    } finally {
      setSavingAddress(false);
    }
  };

  const setDefaultAddress = async (id: string) => {
    try {
      const res = await fetch(`/api/account/addresses/${id}`, {
        method: 'PATCH',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ isDefault: true }),
      });
      const json = await res.json();
      if (json.success) await loadData();
    } catch {
      /* ignore */
    }
  };

  const deleteAddress = async (id: string) => {
    if (!confirm('¿Eliminar esta dirección de envío?')) return;
    try {
      const res = await fetch(`/api/account/addresses/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) await loadData();
      else alert(json.error || 'No se pudo eliminar');
    } catch {
      alert('Error de red');
    }
  };

  const deactivateAccount = async () => {
    if (deactivateConfirm !== 'ELIMINAR') {
      setDeactivateErr('Escribe ELIMINAR para confirmar');
      return;
    }
    setDeactivating(true);
    setDeactivateErr(null);
    try {
      const res = await fetch('/api/account/deactivate', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ confirmation: 'ELIMINAR' }),
      });
      const json = await res.json();
      if (!json.success) {
        setDeactivateErr(json.error || 'No se pudo desactivar');
        return;
      }
      await logout();
      router.push('/?cuenta=desactivada');
    } catch {
      setDeactivateErr('Error de red');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10 sm:py-12">
        <Link
          href="/cuenta"
          className="inline-flex items-center gap-2 text-sm text-charcoal-400 hover:text-primary-500 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a mi cuenta
        </Link>

        <h1 className="font-display text-3xl font-light text-charcoal-700 mb-2">Configuración</h1>
        <p className="font-sans text-sm text-charcoal-400 mb-8">
          Gestiona tu perfil, direcciones de envío y preferencias de cuenta.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-charcoal-400">
            <Loader2 className="w-7 h-7 animate-spin text-primary-400" />
          </div>
        ) : (
          <div className="space-y-8">
            <section className="rounded-2xl border border-champagne-200 bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <User className="w-5 h-5 text-primary-500" />
                <h2 className="font-display text-xl text-charcoal-700">Perfil</h2>
              </div>
              <form onSubmit={saveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-charcoal-400 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profile?.email || user.email}
                    disabled
                    className="w-full rounded-xl border border-champagne-100 bg-champagne-50/50 px-3 py-2.5 text-sm text-charcoal-500 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-charcoal-400">
                    El email no se puede modificar (identificador de cuenta).
                  </p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-charcoal-400 mb-1.5">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-xl border border-champagne-200 px-3 py-2.5 text-sm text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-charcoal-400 mb-1.5">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+56 9 1234 5678"
                    className="w-full rounded-xl border border-champagne-200 px-3 py-2.5 text-sm text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                {profileMsg && (
                  <p
                    className={`text-sm flex items-center gap-1.5 ${
                      profileMsg.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {profileMsg.type === 'ok' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    {profileMsg.text}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white px-5 py-2.5 text-sm font-medium transition-colors"
                >
                  {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar perfil
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-champagne-200 bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-500" />
                  <h2 className="font-display text-xl text-charcoal-700">Direcciones de envío</h2>
                </div>
                {!showAddressForm && (
                  <button
                    type="button"
                    onClick={openNewAddress}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    <Plus className="w-4 h-4" /> Agregar
                  </button>
                )}
              </div>

              <p className="text-xs text-charcoal-400 mb-4">
                Las direcciones se asocian a tus pedidos. En el checkout puedes elegir una guardada o crear una nueva.
              </p>

              {addressMsg && !showAddressForm && (
                <p
                  className={`text-sm mb-3 flex items-center gap-1.5 ${
                    addressMsg.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {addressMsg.type === 'ok' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  {addressMsg.text}
                </p>
              )}

              {showAddressForm && (
                <form
                  onSubmit={saveAddress}
                  className="mb-6 rounded-xl border border-champagne-200 bg-champagne-50/40 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-charcoal-700">
                      {editingId ? 'Editar dirección' : 'Nueva dirección'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddressForm(false);
                        setEditingId(null);
                      }}
                      className="text-charcoal-400 hover:text-charcoal-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-charcoal-400">Etiqueta</label>
                      <input
                        value={addressForm.label}
                        onChange={(e) => setAddressForm((f) => ({ ...f, label: e.target.value }))}
                        className="w-full mt-1 rounded-lg border border-champagne-200 px-3 py-2 text-sm"
                        placeholder="Casa, Trabajo…"
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="inline-flex items-center gap-2 text-sm text-charcoal-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addressForm.isDefault}
                          onChange={(e) =>
                            setAddressForm((f) => ({ ...f, isDefault: e.target.checked }))
                          }
                          className="rounded border-champagne-300 text-primary-500 focus:ring-primary-300"
                        />
                        Dirección por defecto
                      </label>
                    </div>
                    <div>
                      <label className="text-xs text-charcoal-400">Nombre</label>
                      <input
                        required
                        value={addressForm.firstName}
                        onChange={(e) => setAddressForm((f) => ({ ...f, firstName: e.target.value }))}
                        className="w-full mt-1 rounded-lg border border-champagne-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-charcoal-400">Apellido</label>
                      <input
                        required
                        value={addressForm.lastName}
                        onChange={(e) => setAddressForm((f) => ({ ...f, lastName: e.target.value }))}
                        className="w-full mt-1 rounded-lg border border-champagne-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2 grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="text-xs text-charcoal-400">Calle</label>
                        <input
                          required
                          value={addressForm.street}
                          onChange={(e) => setAddressForm((f) => ({ ...f, street: e.target.value }))}
                          className="w-full mt-1 rounded-lg border border-champagne-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-charcoal-400">Número</label>
                        <input
                          required
                          value={addressForm.number}
                          onChange={(e) => setAddressForm((f) => ({ ...f, number: e.target.value }))}
                          className="w-full mt-1 rounded-lg border border-champagne-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-charcoal-400">Depto / oficina</label>
                      <input
                        value={addressForm.apartment}
                        onChange={(e) => setAddressForm((f) => ({ ...f, apartment: e.target.value }))}
                        className="w-full mt-1 rounded-lg border border-champagne-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-charcoal-400">Teléfono</label>
                      <input
                        value={addressForm.phone}
                        onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full mt-1 rounded-lg border border-champagne-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-charcoal-400">Región</label>
                      <select
                        required
                        value={addressForm.region}
                        onChange={(e) =>
                          setAddressForm((f) => ({ ...f, region: e.target.value, commune: '' }))
                        }
                        className="w-full mt-1 rounded-lg border border-champagne-200 px-3 py-2 text-sm bg-white"
                      >
                        <option value="">Selecciona región</option>
                        {CHILE_REGIONS.map((r) => (
                          <option key={r.name} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-charcoal-400">Comuna</label>
                      <select
                        required
                        value={addressForm.commune}
                        onChange={(e) =>
                          setAddressForm((f) => ({
                            ...f,
                            commune: e.target.value,
                            city: e.target.value,
                          }))
                        }
                        disabled={!addressForm.region}
                        className="w-full mt-1 rounded-lg border border-champagne-200 px-3 py-2 text-sm bg-white disabled:opacity-50"
                      >
                        <option value="">Selecciona comuna</option>
                        {communes.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-charcoal-400">Código postal</label>
                      <input
                        value={addressForm.postalCode}
                        onChange={(e) => setAddressForm((f) => ({ ...f, postalCode: e.target.value }))}
                        className="w-full mt-1 rounded-lg border border-champagne-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  {addressMsg && (
                    <p
                      className={`text-sm ${
                        addressMsg.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {addressMsg.text}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={savingAddress}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                    >
                      {savingAddress && <Loader2 className="w-4 h-4 animate-spin" />}
                      {editingId ? 'Actualizar' : 'Guardar dirección'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddressForm(false);
                        setEditingId(null);
                      }}
                      className="rounded-xl border border-champagne-200 px-4 py-2 text-sm text-charcoal-500"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {addresses.length === 0 && !showAddressForm ? (
                <div className="rounded-xl border border-dashed border-champagne-200 py-10 text-center">
                  <Home className="w-8 h-8 text-champagne-300 mx-auto mb-2" />
                  <p className="text-sm text-charcoal-400 mb-3">Aún no tienes direcciones guardadas</p>
                  <button
                    type="button"
                    onClick={openNewAddress}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    Agregar primera dirección
                  </button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {addresses.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-xl border border-champagne-100 p-4 flex flex-col sm:flex-row sm:items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-charcoal-700">{a.label}</span>
                          {a.isDefault && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide bg-primary-50 text-primary-700 border border-primary-100 rounded-full px-2 py-0.5">
                              <Star className="w-3 h-3" /> Por defecto
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-charcoal-600">
                          {a.firstName} {a.lastName}
                        </p>
                        <p className="text-sm text-charcoal-500">
                          {a.street} {a.number}
                          {a.apartment ? `, ${a.apartment}` : ''}
                        </p>
                        <p className="text-sm text-charcoal-500">
                          {a.commune}, {a.region}
                          {a.postalCode ? ` · ${a.postalCode}` : ''}
                        </p>
                        {a.phone && <p className="text-xs text-charcoal-400 mt-0.5">{a.phone}</p>}
                      </div>
                      <div className="flex sm:flex-col gap-1.5 shrink-0">
                        {!a.isDefault && (
                          <button
                            type="button"
                            onClick={() => setDefaultAddress(a.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-champagne-200 text-charcoal-500 hover:border-primary-300 hover:text-primary-600"
                            title="Marcar por defecto"
                          >
                            Por defecto
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditAddress(a)}
                          className="inline-flex items-center justify-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-champagne-200 text-charcoal-500 hover:border-primary-300"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAddress(a.id)}
                          className="inline-flex items-center justify-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-rose-100 text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-champagne-200 bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary-500" />
                  <div>
                    <h2 className="font-display text-xl text-charcoal-700">Pedidos</h2>
                    <p className="text-xs text-charcoal-400 mt-0.5">
                      {profile?._count?.orders ?? 0} pedido(s) registrado(s)
                    </p>
                  </div>
                </div>
                <Link
                  href="/cuenta/pedidos"
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Ver historial →
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-champagne-200 bg-white p-5 sm:p-6 shadow-sm">
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  router.push('/');
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-champagne-200 hover:border-rose-300 hover:text-rose-500 font-sans text-sm font-medium text-charcoal-500 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </section>

            <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 sm:p-6">
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display text-xl text-rose-800">Eliminar cuenta</h2>
                  <p className="text-sm text-rose-700/80 mt-1">
                    Se desactiva tu acceso (no puedes iniciar sesión ni comprar). Conservamos tus
                    datos por motivos legales e históricos. Puedes reactivar la cuenta más adelante
                    con tu email y contraseña. Solo un administrador puede borrar definitivamente
                    una cuenta sin pedidos.
                  </p>
                </div>
              </div>

              {!showDeactivate ? (
                <button
                  type="button"
                  onClick={() => setShowDeactivate(true)}
                  className="mt-2 text-sm font-medium text-rose-600 hover:text-rose-700 underline underline-offset-2"
                >
                  Solicitar eliminación de cuenta
                </button>
              ) : (
                <div className="mt-4 space-y-3 rounded-xl bg-white border border-rose-100 p-4">
                  <p className="text-sm text-charcoal-600">
                    Escribe <strong className="text-rose-600">ELIMINAR</strong> para confirmar la
                    desactivación:
                  </p>
                  <input
                    value={deactivateConfirm}
                    onChange={(e) => setDeactivateConfirm(e.target.value)}
                    placeholder="ELIMINAR"
                    className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                  />
                  {deactivateErr && <p className="text-sm text-rose-600">{deactivateErr}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={deactivating}
                      onClick={deactivateAccount}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                    >
                      {deactivating && <Loader2 className="w-4 h-4 animate-spin" />}
                      Desactivar mi cuenta
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeactivate(false);
                        setDeactivateConfirm('');
                        setDeactivateErr(null);
                      }}
                      className="rounded-xl border border-champagne-200 px-4 py-2 text-sm text-charcoal-500"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
