'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, MapPin, ShoppingBag, KeyRound, Trash2, Save,
  UserX, UserCheck, Loader2, Plus, Star,
} from 'lucide-react';
import { formatCLP } from '@/lib/utils/api';
import { CHILE_REGION_NAMES, communesForRegion } from '@/lib/chile/geo';
import toast from 'react-hot-toast';

type Address = {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  street: string;
  number: string;
  apartment: string | null;
  commune: string;
  city: string;
  region: string;
  postalCode: string | null;
  phone: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
};

type Client = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  isActive: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
  addresses: Address[];
  orders: OrderRow[];
  _count: { orders: number; addresses: number };
};

const emptyAddr = {
  label: 'Casa',
  firstName: '',
  lastName: '',
  street: '',
  number: '',
  apartment: '',
  commune: '',
  city: '',
  region: 'Metropolitana',
  phone: '',
  isDefault: true,
};

export default function ClienteDetailClient({ client: initial }: { client: Client }) {
  const router = useRouter();
  const [client, setClient] = useState(initial);
  const [profile, setProfile] = useState({ name: client.name || '', phone: client.phone || '' });
  const [saving, setSaving] = useState(false);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrForm, setAddrForm] = useState(emptyAddr);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: profile.name, phone: profile.phone || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setClient((c) => ({ ...c, name: data.data.client.name, phone: data.data.client.phone }));
      toast.success('Perfil actualizado');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !client.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setClient((c) => ({ ...c, isActive: !c.isActive }));
      toast.success(client.isActive ? 'Cliente inactivado' : 'Cliente activado');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!confirm('¿Reiniciar contraseña? Se cerrarán las sesiones activas del cliente.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'reset-password' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setTempPassword(data.data.tempPassword);
      setClient((c) => ({ ...c, hasPassword: true }));
      toast.success('Contraseña reiniciada');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async () => {
    if (client._count.orders > 0) {
      toast.error('No se puede eliminar: tiene pedidos. Inactívalo en su lugar.');
      return;
    }
    if (!confirm('¿Eliminar permanentemente este cliente? Esta acción no se puede deshacer.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success('Cliente eliminado');
      router.push('/admin/clientes');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveAddress = async () => {
    setSaving(true);
    try {
      const url = editingAddrId
        ? `/api/admin/clients/${client.id}/addresses/${editingAddrId}`
        : `/api/admin/clients/${client.id}/addresses`;
      const method = editingAddrId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...addrForm,
          apartment: addrForm.apartment || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success(editingAddrId ? 'Dirección actualizada' : 'Dirección creada');
      setShowAddrForm(false);
      setEditingAddrId(null);
      setAddrForm(emptyAddr);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAddress = async (addressId: string) => {
    if (!confirm('¿Eliminar esta dirección?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/addresses/${addressId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success('Dirección eliminada');
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditAddr = (a: Address) => {
    setEditingAddrId(a.id);
    setAddrForm({
      label: a.label,
      firstName: a.firstName,
      lastName: a.lastName,
      street: a.street,
      number: a.number,
      apartment: a.apartment || '',
      commune: a.commune,
      city: a.city,
      region: a.region,
      phone: a.phone || '',
      isDefault: a.isDefault,
    });
    setShowAddrForm(true);
  };

  const communes = communesForRegion(addrForm.region);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Columna principal */}
      <div className="lg:col-span-2 space-y-5">
        {/* Perfil */}
        <div className="bg-white rounded-2xl border border-champagne-100 p-6">
          <h2 className="font-sans font-semibold text-charcoal-700 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-primary-500" /> Perfil
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1">Nombre</label>
              <input
                className="input-field"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1">Teléfono</label>
              <input
                className="input-field"
                value={profile.phone}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-sans text-xs font-semibold text-charcoal-500 mb-1">Email</label>
              <input className="input-field bg-champagne-50" value={client.email} disabled />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={saveProfile} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar perfil
            </button>
          </div>
        </div>

        {/* Direcciones */}
        <div className="bg-white rounded-2xl border border-champagne-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans font-semibold text-charcoal-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-500" /> Direcciones ({client.addresses.length})
            </h2>
            <button
              onClick={() => {
                setEditingAddrId(null);
                setAddrForm({ ...emptyAddr, firstName: profile.name.split(' ')[0] || '', lastName: profile.name.split(' ').slice(1).join(' ') || '' });
                setShowAddrForm(true);
              }}
              className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
            >
              <Plus className="w-4 h-4" /> Nueva
            </button>
          </div>

          {showAddrForm && (
            <div className="mb-4 p-4 rounded-xl border border-primary-200 bg-primary-50/30 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input className="input-field" placeholder="Etiqueta" value={addrForm.label} onChange={(e) => setAddrForm((f) => ({ ...f, label: e.target.value }))} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={addrForm.isDefault} onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))} />
                  Default
                </label>
                <input className="input-field" placeholder="Nombre" value={addrForm.firstName} onChange={(e) => setAddrForm((f) => ({ ...f, firstName: e.target.value }))} />
                <input className="input-field" placeholder="Apellido" value={addrForm.lastName} onChange={(e) => setAddrForm((f) => ({ ...f, lastName: e.target.value }))} />
                <input className="input-field sm:col-span-2" placeholder="Calle" value={addrForm.street} onChange={(e) => setAddrForm((f) => ({ ...f, street: e.target.value }))} />
                <input className="input-field" placeholder="Número" value={addrForm.number} onChange={(e) => setAddrForm((f) => ({ ...f, number: e.target.value }))} />
                <input className="input-field" placeholder="Depto (opcional)" value={addrForm.apartment} onChange={(e) => setAddrForm((f) => ({ ...f, apartment: e.target.value }))} />
                <select className="input-field" value={addrForm.region} onChange={(e) => setAddrForm((f) => ({ ...f, region: e.target.value, commune: '' }))}>
                  {CHILE_REGION_NAMES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select className="input-field" value={addrForm.commune} onChange={(e) => setAddrForm((f) => ({ ...f, commune: e.target.value }))}>
                  <option value="">Comuna</option>
                  {communes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input className="input-field" placeholder="Ciudad" value={addrForm.city} onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))} />
                <input className="input-field" placeholder="Teléfono" value={addrForm.phone} onChange={(e) => setAddrForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={saveAddress} disabled={saving} className="btn-primary text-sm">Guardar dirección</button>
                <button onClick={() => { setShowAddrForm(false); setEditingAddrId(null); }} className="text-sm text-charcoal-500">Cancelar</button>
              </div>
            </div>
          )}

          {client.addresses.length === 0 && !showAddrForm ? (
            <p className="font-sans text-sm text-charcoal-400">Sin direcciones registradas.</p>
          ) : (
            <div className="space-y-3">
              {client.addresses.map((a) => (
                <div key={a.id} className="p-4 rounded-xl border border-champagne-100 flex justify-between gap-4">
                  <div className="font-sans text-sm text-charcoal-600">
                    <p className="font-medium flex items-center gap-2">
                      {a.label}
                      {a.isDefault && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                    </p>
                    <p>{a.firstName} {a.lastName}</p>
                    <p>{a.street} {a.number}{a.apartment ? `, ${a.apartment}` : ''}</p>
                    <p>{a.commune}, {a.city}, {a.region}</p>
                    {a.phone && <p>{a.phone}</p>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => startEditAddr(a)} className="text-xs text-primary-600 hover:underline">Editar</button>
                    <button onClick={() => deleteAddress(a.id)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pedidos recientes */}
        <div className="bg-white rounded-2xl border border-champagne-100 p-6">
          <h2 className="font-sans font-semibold text-charcoal-700 mb-4 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary-500" /> Pedidos ({client._count.orders})
          </h2>
          {client.orders.length === 0 ? (
            <p className="font-sans text-sm text-charcoal-400">Sin pedidos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-charcoal-400 uppercase">
                    <th className="pb-2">Pedido</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2">Pago</th>
                    <th className="pb-2">Total</th>
                    <th className="pb-2">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-champagne-50">
                  {client.orders.map((o) => (
                    <tr key={o.id}>
                      <td className="py-2">
                        <Link href={`/admin/pedidos/${o.id}`} className="text-primary-600 hover:underline font-medium">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="py-2">{o.status}</td>
                      <td className="py-2">{o.paymentStatus}</td>
                      <td className="py-2 font-semibold">{formatCLP(o.total)}</td>
                      <td className="py-2 text-charcoal-400">{new Date(o.createdAt).toLocaleDateString('es-CL')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar acciones */}
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-champagne-100 p-6 space-y-4">
          <h2 className="font-sans font-semibold text-charcoal-700">Estado</h2>
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
              client.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
            }`}
          >
            {client.isActive ? 'Activo' : 'Inactivo'}
          </span>
          <p className="font-sans text-xs text-charcoal-400">
            Registrado: {new Date(client.createdAt).toLocaleDateString('es-CL', { dateStyle: 'long' })}
          </p>
          <button
            onClick={toggleActive}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-champagne-200 hover:bg-champagne-50 text-sm font-medium"
          >
            {client.isActive ? <UserX className="w-4 h-4 text-amber-600" /> : <UserCheck className="w-4 h-4 text-emerald-600" />}
            {client.isActive ? 'Inactivar cuenta' : 'Activar cuenta'}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-champagne-100 p-6 space-y-4">
          <h2 className="font-sans font-semibold text-charcoal-700 flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Contraseña
          </h2>
          <p className="font-sans text-xs text-charcoal-400">
            {client.hasPassword
              ? 'Cuenta con email/password.'
              : 'Cuenta solo OAuth (Google). Al resetear se habilita login por email.'}
          </p>
          <button
            onClick={resetPassword}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-champagne-200 hover:bg-champagne-50 text-sm font-medium"
          >
            <KeyRound className="w-4 h-4" /> Reiniciar contraseña
          </button>
          {tempPassword && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm">
              <p className="font-semibold text-amber-800">Contraseña temporal:</p>
              <code className="font-mono text-amber-900 select-all">{tempPassword}</code>
              <p className="text-xs text-amber-700 mt-1">Cópiala y envíasela al cliente. Solo se muestra una vez.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-red-100 p-6 space-y-3">
          <h2 className="font-sans font-semibold text-red-700 flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Zona peligrosa
          </h2>
          <p className="font-sans text-xs text-charcoal-400">
            Solo se puede eliminar si no tiene pedidos ({client._count.orders} actuales).
          </p>
          <button
            onClick={deleteClient}
            disabled={saving || client._count.orders > 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" /> Eliminar cliente
          </button>
        </div>
      </div>
    </div>
  );
}
