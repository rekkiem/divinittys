'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Edit2, Trash2, Eye, EyeOff, Search, Package } from 'lucide-react';
import { formatCLP } from '@/lib/utils/api';
import toast from 'react-hot-toast';

type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  price?: number;
  basePrice?: number;
  basePrice?: number;
  comparePrice: number | null;
  isActive: boolean;
  isFeatured: boolean;
  category: { name: string } | null;
  brand: { name: string } | null;
  images: { url: string }[];
  inventory: { stock: number } | null;
};

export default function AdminProductsClient({ products: initial }: { products: Product[] }) {
  const [products, setProducts] = useState(initial);
  const [search, setSearch] = useState('');

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/products/id/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: !current } : p))
        );
        toast.success(!current ? 'Producto activado' : 'Producto desactivado');
      }
    } catch {
      toast.error('Error al actualizar producto');
    }
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/products/id/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        toast.success('Producto eliminado');
      } else {
        toast.error('Error al eliminar producto');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10 py-2.5 text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-champagne-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-champagne-100 bg-champagne-50/50">
                <th className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-6 py-4">Producto</th>
                <th className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4">Categoría</th>
                <th className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4">Precio</th>
                <th className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4">Stock</th>
                <th className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4">Estado</th>
                <th className="text-right font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-champagne-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Package className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
                    <p className="font-sans text-charcoal-400">
                      {search ? 'No se encontraron productos' : 'No hay productos aún'}
                    </p>
                    {!search && (
                      <Link href="/admin/importar" className="font-sans text-sm text-primary-500 hover:underline mt-2 inline-block">
                        Importar desde Excel →
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr key={product.id} className="hover:bg-champagne-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-champagne-50 flex-shrink-0">
                          {product.images[0] ? (
                            <Image
                              src={product.images[0].url}
                              alt={product.name}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 text-charcoal-300" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-sans font-semibold text-charcoal-700 text-sm">{product.name}</p>
                          {product.sku && (
                            <p className="font-mono text-xs text-charcoal-400">SKU: {product.sku}</p>
                          )}
                          {product.brand && (
                            <p className="font-sans text-xs text-charcoal-400">{product.brand.name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-sans text-sm text-charcoal-600">
                        {product.category?.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-sans font-semibold text-charcoal-700 text-sm">
                          {formatCLP(Number(product.basePrice ?? product.price ?? 0))}
                        </p>
                        {product.comparePrice && (
                          <p className="font-sans text-xs text-charcoal-400 line-through">
                            {formatCLP(product.comparePrice!)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`font-sans text-sm font-semibold ${
                          (product.inventory?.stock ?? 0) > 10
                            ? 'text-emerald-600'
                            : (product.inventory?.stock ?? 0) > 0
                            ? 'text-amber-600'
                            : 'text-red-500'
                        }`}
                      >
                        {product.inventory?.stock ?? 0} u.
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleActive(product.id, product.isActive)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-semibold transition-colors ${
                          product.isActive
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-charcoal-100 text-charcoal-500 hover:bg-charcoal-200'
                        }`}
                      >
                        {product.isActive ? (
                          <><Eye className="w-3 h-3" /> Activo</>
                        ) : (
                          <><EyeOff className="w-3 h-3" /> Inactivo</>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/productos/${product.slug}/editar`}
                          className="p-2 rounded-lg text-charcoal-400 hover:text-primary-500 hover:bg-primary-50 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => deleteProduct(product.id, product.name)}
                          className="p-2 rounded-lg text-charcoal-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
