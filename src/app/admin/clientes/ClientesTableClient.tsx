'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, Eye, UserX, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

type ClientRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string | Date;
  _count: { orders: number; addresses: number };
};

export default function ClientesTableClient({ initialClients }: { initialClients: ClientRow[] }) {
  const [clients, setClients] = useState(initialClients);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const toggleActive = async (c: ClientRow) => {
    setLoadingId(c.id);
    try {
      const res = await fetch(`/api/admin/clients/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar');
      setClients((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, isActive: !c.isActive } : x))
      );
      toast.success(c.isActive ? 'Cliente inactivado' : 'Cliente activado');
    } catch (err: any) {
      toast.error(err?.message || 'Error');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-champagne-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-champagne-100 bg-champagne-50/50">
              {['Cliente', 'Email', 'Teléfono', 'Pedidos', 'Direcciones', 'Registro', 'Estado', 'Acciones'].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-champagne-50">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <Users className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
                  <p className="font-sans text-charcoal-400">No hay clientes aún</p>
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id} className="hover:bg-champagne-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="font-sans font-medium text-sm text-charcoal-700 hover:text-primary-600"
                    >
                      {c.name || '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-sans text-sm text-charcoal-600">{c.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-sans text-sm text-charcoal-500">{c.phone || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-sans text-sm font-semibold text-primary-600">{c._count.orders}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-sans text-sm text-charcoal-500">{c._count.addresses}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-sans text-xs text-charcoal-400">
                      {new Date(c.createdAt).toLocaleDateString('es-CL')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold font-sans ${
                        c.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {c.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="p-1.5 rounded-lg hover:bg-champagne-100 text-charcoal-500 hover:text-primary-600"
                        title="Ver ficha"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => toggleActive(c)}
                        disabled={loadingId === c.id}
                        className="p-1.5 rounded-lg hover:bg-champagne-100 text-charcoal-500 disabled:opacity-50"
                        title={c.isActive ? 'Inactivar' : 'Activar'}
                      >
                        {c.isActive ? (
                          <UserX className="w-4 h-4 text-amber-600" />
                        ) : (
                          <UserCheck className="w-4 h-4 text-emerald-600" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
