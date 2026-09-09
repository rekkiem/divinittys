'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/hooks/useAuth';

type Props = {
  /** Ruta del endpoint de export, ej. /api/admin/orders/export */
  endpoint: string;
  /** Query string opcional (filtros actuales) sin el ? inicial */
  query?: string;
  filename?: string;
  label?: string;
};

export default function ExportExcelButton({
  endpoint,
  query = '',
  filename = 'export.xlsx',
  label = 'Exportar Excel',
}: Props) {
  const [loading, setLoading] = useState(false);
  const { accessToken } = useAuthStore();

  const handleExport = async () => {
    setLoading(true);
    try {
      const url = query ? `${endpoint}?${query}` : endpoint;
      const headers: Record<string, string> = {};
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch(url, { headers, credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let name = filename;
      const match = disposition?.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) name = match[1];

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success('Excel descargado');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo exportar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="btn-secondary flex items-center gap-2 text-sm py-2 disabled:opacity-60"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {loading ? 'Exportando…' : label}
    </button>
  );
}
