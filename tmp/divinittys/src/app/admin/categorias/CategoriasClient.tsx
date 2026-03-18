'use client';
import { useState } from 'react';
import { Tag, Plus, Pencil, Check, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { slugify } from '@/lib/utils/api';
import { useAuthStore } from '@/hooks/useAuth';

type Category = {
  id: string; name: string; slug: string; parentId: string | null;
  isActive: boolean; sortOrder: number; _count: { products: number };
};

export default function CategoriasClient({ categories: initial }: { categories: Category[] }) {
  const [categories, setCategories] = useState(initial);
  const [editId, setEditId]   = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName]   = useState('');
  const [loading, setLoading]   = useState(false);
  const { accessToken }         = useAuthStore();
  const router = useRouter();

  const authHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  });

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ name: editName.trim(), slug: slugify(editName.trim()) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      setCategories(cs => cs.map(c => c.id === id ? { ...c, name: editName.trim() } : c));
      setEditId(null);
      toast.success('Categoría actualizada');
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const createCategory = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ name: newName.trim(), slug: slugify(newName.trim()) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setCategories(cs => [...cs, { ...data.data.category, _count: { products: 0 } }]);
      setNewName('');
      toast.success('Categoría creada');
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ isActive: !current }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      setCategories(cs => cs.map(c => c.id === id ? { ...c, isActive: !current } : c));
      toast.success(!current ? 'Activada' : 'Desactivada');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-champagne-100 p-5">
        <h2 className="font-sans font-semibold text-charcoal-700 mb-3">Nueva categoría</h2>
        <div className="flex gap-3">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createCategory()}
            placeholder="Nombre de la categoría" className="input-field flex-1 text-sm" />
          <button onClick={createCategory} disabled={loading || !newName.trim()}
            className="btn-primary flex items-center gap-2 text-sm py-2.5 px-4 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crear
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-champagne-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-champagne-100 bg-champagne-50/50">
              {['Categoría','Slug','Productos','Estado','Acciones'].map(h => (
                <th key={h} className="text-left font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-4 py-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-champagne-50">
            {categories.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12">
                <Tag className="w-10 h-10 text-charcoal-200 mx-auto mb-2" />
                <p className="font-sans text-charcoal-400 text-sm">No hay categorías</p>
              </td></tr>
            ) : categories.map(cat => (
              <tr key={cat.id} className="hover:bg-champagne-50/30 transition-colors">
                <td className="px-4 py-3">
                  {editId === cat.id ? (
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit(cat.id)}
                      className="input-field text-sm py-1.5 w-48" autoFocus />
                  ) : (
                    <span className="font-sans font-medium text-sm text-charcoal-700">{cat.name}</span>
                  )}
                </td>
                <td className="px-4 py-3"><span className="font-mono text-xs text-charcoal-400">{cat.slug}</span></td>
                <td className="px-4 py-3"><span className="font-sans text-sm font-semibold text-primary-600">{cat._count.products}</span></td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(cat.id, cat.isActive)}
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold font-sans cursor-pointer ${cat.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-charcoal-100 text-charcoal-500'}`}>
                    {cat.isActive ? 'Activa' : 'Inactiva'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {editId === cat.id ? (
                      <>
                        <button onClick={() => saveEdit(cat.id)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <button onClick={() => { setEditId(cat.id); setEditName(cat.name); }}
                        className="p-1.5 rounded-lg hover:bg-primary-50 text-charcoal-400 hover:text-primary-500">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
