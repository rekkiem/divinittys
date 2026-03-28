'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Edit2, Trash2, Eye, EyeOff, Search, Package, CheckSquare, Zap } from 'lucide-react';
import { formatCLP } from '@/lib/utils/api';
import { useAuthStore } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

type Product = {
  id: string; name: string; slug: string; sku: string | null;
  price?: number; basePrice?: number; comparePrice: number | null;
  isActive: boolean; isFeatured: boolean;
  category: { name: string } | null; brand: { name: string } | null;
  images: { url: string }[]; inventory: { stock: number } | null;
  imageUrl?: string | null;
};

export default function AdminProductsClient({ products: initial }: { products: Product[] }) {
  const [products, setProducts] = useState(initial);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const { accessToken } = useAuthStore();

  const authHeaders = (extra: Record<string, string> = {}) => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...extra,
  });

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  // ── Single toggle ─────────────────────────────────────────────────
  const toggleActive = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/products/id/${id}`, {
        method: 'PATCH', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ isActive: !current }),
      });
      if (res.ok) {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, isActive: !current } : p));
        toast.success(!current ? 'Producto activado' : 'Producto desactivado');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Error al actualizar');
      }
    } catch { toast.error('Error de conexión'); }
  };

  // ── Delete single ─────────────────────────────────────────────────
  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/products/id/${id}`, {
        method: 'DELETE', headers: authHeaders(), credentials: 'include',
      });
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== id));
        toast.success('Producto eliminado');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Error al eliminar');
      }
    } catch { toast.error('Error de conexión'); }
  };

  // ── Batch activate all (fix for ML-imported inactive products) ─────
  const batchAction = async (action: 'activate' | 'deactivate', scope: 'selected' | 'all') => {
    const ids   = scope === 'selected' ? Array.from(selected) : undefined;
    const isAll = scope === 'all';

    if (scope === 'selected' && selected.size === 0) {
      toast.error('Selecciona al menos un producto');
      return;
    }

    const label = action === 'activate' ? 'activar' : 'desactivar';
    const count = scope === 'all' ? products.length : selected.size;
    if (!confirm(`¿${label.charAt(0).toUpperCase() + label.slice(1)} ${isAll ? 'todos los' : count} producto(s)?`)) return;

    setBatchLoading(true);
    try {
      const res = await fetch('/api/admin/products/batch', {
        method: 'POST', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ action, ids, all: isAll }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update local state
      setProducts(prev =>
        prev.map(p => {
          const affected = isAll || (ids && ids.includes(p.id));
          return affected ? { ...p, isActive: action === 'activate' } : p;
        })
      );
      setSelected(new Set());
      toast.success(`✅ ${data.data.message}`);
    } catch (e: any) {
      toast.error(e.message || 'Error en operación batch');
    } finally {
      setBatchLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(p => p.id)));
  };

  const getImageUrl = (p: Product) =>
    p.images?.[0]?.url || p.imageUrl || '/placeholder-product.svg';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
          <input type="text" placeholder="Buscar por nombre o SKU..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="input-field pl-10 py-2.5 text-sm w-full" />
        </div>

        {/* Batch actions */}
        <div className="flex gap-2">
          <button
            onClick={() => batchAction('activate', 'all')}
            disabled={batchLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold font-sans hover:bg-emerald-200 transition-colors disabled:opacity-50"
            title="Activar todos los productos (útil tras importación masiva)"
          >
            <Zap className="w-3.5 h-3.5" />
            Activar todos
          </button>
          {selected.size > 0 && (
            <>
              <button
                onClick={() => batchAction('activate', 'selected')}
                disabled={batchLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold font-sans hover:bg-emerald-200 transition-colors disabled:opacity-50"
              >
                <Eye className="w-3.5 h-3.5" />
                Activar ({selected.size})
              </button>
              <button
                onClick={() => batchAction('deactivate', 'selected')}
                disabled={batchLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-charcoal-100 text-charcoal-600 rounded-xl text-xs font-semibold font-sans hover:bg-charcoal-200 transition-colors disabled:opacity-50"
              >
                <EyeOff className="w-3.5 h-3.5" />
                Desactivar ({selected.size})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-champagne-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-champagne-100 bg-champagne-50/50">
                <th className="px-4 py-4 w-10">
                  <input type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={selectAll}
                    className="accent-primary-500 w-4 h-4"
                  />
                </th>
                {['Producto','Categoría','Precio','Stock','Estado','Acciones'].map(h => (
                  <th key={h} className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-champagne-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16">
                  <Package className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
                  <p className="font-sans text-charcoal-400">
                    {search ? 'No se encontraron productos' : 'No hay productos aún'}
                  </p>
                </td></tr>
              ) : filtered.map(product => (
                <tr key={product.id} className={`hover:bg-champagne-50/30 transition-colors ${selected.has(product.id) ? 'bg-primary-50/30' : ''}`}>
                  <td className="px-4 py-4">
                    <input type="checkbox" checked={selected.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="accent-primary-500 w-4 h-4" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-champagne-50 flex-shrink-0">
                        <Image
                          src={getImageUrl(product)}
                          alt={product.name}
                          width={48} height={48}
                          className="w-full h-full object-cover"
                          unoptimized={getImageUrl(product).includes(':9000')}
                          onError={e => { (e.target as HTMLImageElement).src = '/placeholder-product.svg'; }}
                        />
                      </div>
                      <div>
                        <p className="font-sans font-semibold text-charcoal-700 text-sm">{product.name}</p>
                        {product.sku && <p className="font-mono text-xs text-charcoal-400">SKU: {product.sku}</p>}
                        {product.brand && <p className="font-sans text-xs text-charcoal-400">{product.brand.name}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-sans text-sm text-charcoal-600">{product.category?.name || '—'}</span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-sans font-semibold text-charcoal-700 text-sm">
                      {formatCLP(Number(product.basePrice ?? product.price ?? 0))}
                    </p>
                    {product.comparePrice && (
                      <p className="font-sans text-xs text-charcoal-400 line-through">
                        {formatCLP(product.comparePrice)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`font-sans text-sm font-semibold ${
                      (product.inventory?.stock ?? 0) > 10 ? 'text-emerald-600'
                      : (product.inventory?.stock ?? 0) > 0 ? 'text-amber-600' : 'text-red-500'
                    }`}>
                      {product.inventory?.stock ?? 0} u.
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button onClick={() => toggleActive(product.id, product.isActive)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-semibold transition-colors ${
                        product.isActive
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-charcoal-100 text-charcoal-500 hover:bg-charcoal-200'
                      }`}>
                      {product.isActive ? <><Eye className="w-3 h-3" />Activo</> : <><EyeOff className="w-3 h-3" />Inactivo</>}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/productos/${product.slug}/editar`}
                        className="p-2 rounded-lg text-charcoal-400 hover:text-primary-500 hover:bg-primary-50 transition-colors"
                        title="Editar">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button onClick={() => deleteProduct(product.id, product.name)}
                        className="p-2 rounded-lg text-charcoal-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > 0 && (
        <p className="font-sans text-xs text-charcoal-400 text-right">
          Mostrando {filtered.length} de {products.length} productos
          {selected.size > 0 && ` · ${selected.size} seleccionados`}
        </p>
      )}
    </div>
  );
}
