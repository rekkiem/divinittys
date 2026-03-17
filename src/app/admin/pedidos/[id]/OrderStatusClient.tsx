'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const STATUSES = ['PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED'] as const;
const LABELS: Record<string, string> = {
  PENDING:'Pendiente', CONFIRMED:'Confirmado', PROCESSING:'En proceso',
  SHIPPED:'Enviado', DELIVERED:'Entregado', CANCELLED:'Cancelado',
};

export default function OrderStatusClient({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      setStatus(newStatus);
      toast.success('Estado actualizado');
      router.refresh();
    } catch {
      toast.error('Error al actualizar estado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-champagne-100 p-6">
      <h2 className="font-sans font-semibold text-charcoal-700 mb-3">Estado del pedido</h2>
      <select value={status} onChange={e => updateStatus(e.target.value)} disabled={loading}
        className="w-full input-field text-sm">
        {STATUSES.map(s => <option key={s} value={s}>{LABELS[s]}</option>)}
      </select>
    </div>
  );
}
