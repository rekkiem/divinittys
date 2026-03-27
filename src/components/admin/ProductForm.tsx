'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUploader from '@/components/admin/ImageUploader';
import { Loader2, Save, ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { slugify } from '@/lib/utils/api';
import { useAuthStore } from '@/hooks/useAuth';

type Category = { id: string; name: string; slug: string };
type Brand    = { id: string; name: string; slug: string };

type ImagePayload = { url: string; isMain: boolean; id?: string };

type ProductFormProps = {
  categories: Category[];
  brands: Brand[];
  initialData?: {
    id: string; sku: string; name: string; slug: string;
    description: string | null; shortDescription: string | null;
    categoryId: string; brandId: string | null;
    basePrice: number; comparePrice: number | null; costPrice: number | null;
    isActive: boolean; isFeatured: boolean; isOnSale: boolean;
    tags: string[]; weight: number | null;
    inventory: { stock: number; lowStockThreshold: number; trackStock: boolean } | null;
    images?: ImagePayload[];
  };
};

export default function ProductForm({ categories, brands, initialData }: ProductFormProps) {
  const router = useRouter();
  // FIX: get accessToken from Zustand to send as Authorization header
  const { accessToken } = useAuthStore();
  const isEdit = !!initialData;

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [images, setImages] = useState<ImagePayload[]>(initialData?.images ?? []);
  const [form, setForm] = useState({
    sku:               initialData?.sku ?? '',
    name:              initialData?.name ?? '',
    slug:              initialData?.slug ?? '',
    description:       initialData?.description ?? '',
    shortDescription:  initialData?.shortDescription ?? '',
    categoryId:        initialData?.categoryId ?? (categories[0]?.id ?? ''),
    brandId:           initialData?.brandId ?? '',
    basePrice:         initialData?.basePrice?.toString() ?? '',
    comparePrice:      initialData?.comparePrice?.toString() ?? '',
    costPrice:         initialData?.costPrice?.toString() ?? '',
    isActive:          initialData?.isActive ?? true,
    isFeatured:        initialData?.isFeatured ?? false,
    isOnSale:          initialData?.isOnSale ?? false,
    tags:              initialData?.tags ?? [] as string[],
    weight:            initialData?.weight?.toString() ?? '',
    stock:             initialData?.inventory?.stock?.toString() ?? '0',
    lowStockThreshold: initialData?.inventory?.lowStockThreshold?.toString() ?? '5',
    trackStock:        initialData?.inventory?.trackStock ?? true,
  });

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleNameChange = (name: string) => {
    set('name', name);
    if (!isEdit) set('slug', slugify(name));
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      set('tags', [...form.tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => set('tags', form.tags.filter((t: string) => t !== tag));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.categoryId) { toast.error('Selecciona una categoría'); return; }
    if (!form.basePrice || parseFloat(form.basePrice) <= 0) {
      toast.error('El precio base es requerido y debe ser mayor a 0');
      return;
    }

    setLoading(true);
    try {
      const imageUrls = images.map(i => i.url).filter(Boolean);
      const mainImage = images.find(i => i.isMain)?.url || imageUrls[0] || null;

      const payload: any = {
        sku:               form.sku || `SKU-${Date.now()}`,
        name:              form.name,
        slug:              form.slug || slugify(form.name),
        description:       form.description || null,
        shortDescription:  form.shortDescription || null,
        categoryId:        form.categoryId,
        brandId:           form.brandId || null,
        basePrice:         parseFloat(form.basePrice),
        comparePrice:      form.comparePrice ? parseFloat(form.comparePrice) : null,
        costPrice:         form.costPrice ? parseFloat(form.costPrice) : null,
        isActive:          form.isActive,
        isFeatured:        form.isFeatured,
        isOnSale:          form.isOnSale,
        tags:              form.tags,
        weight:            form.weight ? parseFloat(form.weight) : null,
        stock:             parseInt(form.stock) || 0,
        lowStockThreshold: parseInt(form.lowStockThreshold) || 5,
        trackStock:        form.trackStock,
        imageUrl:         mainImage,
        imageUrls,
      };

      // FIX: correct URL with template literal + correct method per action
      const url    = isEdit ? `/api/admin/products/${initialData!.id}` : '/api/admin/products';
      const method = isEdit ? 'PATCH' : 'POST';

      // FIX: send Authorization header WITH the token from Zustand store
      // This ensures the token reaches the API even if cookie has issues
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',   // also send cookie as fallback
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // FIX: specific error messages based on HTTP status
        if (res.status === 401) throw new Error('Sesión expirada — inicia sesión nuevamente');
        if (res.status === 403) throw new Error('Sin permisos de administrador');
        if (res.status === 400) throw new Error(data.error || 'Datos inválidos');
        throw new Error(data.error || `Error ${res.status}`);
      }

      toast.success(isEdit ? '✅ Producto actualizado' : '✅ Producto creado');
      router.push('/admin/productos');
      router.refresh();
    } catch (err: any) {
      const msg = err.message || 'Error al guardar producto';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fieldCls  = "input-field text-sm";
  const labelCls  = "block font-sans text-xs font-semibold text-charcoal-500 mb-1.5 uppercase tracking-wider";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-charcoal-400">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-3xl font-medium text-charcoal-700">
            {isEdit ? 'Editar Producto' : 'Nuevo Producto'}
          </h1>
          <p className="font-sans text-sm text-muted-foreground mt-0.5">
            {isEdit ? `Editando: ${initialData!.name}` : 'Completa los datos del producto'}
          </p>
        </div>
      </div>

      {/* Error banner */}
      {formError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-sans text-sm">{formError}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
            <h2 className="font-sans font-semibold text-charcoal-700">Información básica</h2>

            <div>
              <label className={labelCls}>Nombre *</label>
              <input type="text" value={form.name} onChange={e => handleNameChange(e.target.value)}
                required placeholder="Ej: Shampoo Reparador Intensivo" className={fieldCls} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>SKU</label>
                <input type="text" value={form.sku} onChange={e => set('sku', e.target.value)}
                  placeholder="Auto-generado si está vacío" className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Slug URL</label>
                <input type="text" value={form.slug} onChange={e => set('slug', e.target.value)}
                  placeholder="shampoo-reparador" className={fieldCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Descripción corta</label>
              <input type="text" value={form.shortDescription}
                onChange={e => set('shortDescription', e.target.value)}
                placeholder="Resumen en 1-2 líneas" className={fieldCls} />
            </div>

            <div>
              <label className={labelCls}>Descripción completa</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={5} placeholder="Descripción detallada del producto..."
                className={fieldCls + " resize-none"} />
            </div>

            <div>
              <label className={labelCls}>Tags</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="cabello, reparación... (Enter para agregar)"
                  className={fieldCls + " flex-1"} />
                <button type="button" onClick={addTag}
                  className="px-3 py-2 bg-primary-100 text-primary-600 rounded-xl hover:bg-primary-200 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.tags.map((tag: string) => (
                  <span key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-champagne-100 text-charcoal-600 rounded-full text-xs font-sans">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}>
                      <Trash2 className="w-3 h-3 hover:text-red-500" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-sans font-semibold text-charcoal-700">Precios</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Precio base * (CLP)</label>
                <input type="number" value={form.basePrice} onChange={e => set('basePrice', e.target.value)}
                  required min="1" step="1" placeholder="9990" className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Precio comparación</label>
                <input type="number" value={form.comparePrice} onChange={e => set('comparePrice', e.target.value)}
                  min="0" step="1" placeholder="14990 (tachado)" className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Costo interno</label>
                <input type="number" value={form.costPrice} onChange={e => set('costPrice', e.target.value)}
                  min="0" step="1" placeholder="5000" className={fieldCls} />
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-sans font-semibold text-charcoal-700">Imágenes</h2>
            <ImageUploader
              productId={isEdit ? initialData?.id : undefined}
              initialImages={images}
              onImagesChange={(next) => setImages(next)}
              maxImages={8}
            />
            <p className="text-xs text-charcoal-400">Selecciona al menos una imagen. La primera será la imagen principal.</p>
          </div>

          {/* Stock */}
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-sans font-semibold text-charcoal-700">Inventario</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Stock inicial</label>
                <input type="number" value={form.stock} onChange={e => set('stock', e.target.value)}
                  min="0" className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Alerta stock bajo</label>
                <input type="number" value={form.lowStockThreshold}
                  onChange={e => set('lowStockThreshold', e.target.value)}
                  min="0" className={fieldCls} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.trackStock}
                    onChange={e => set('trackStock', e.target.checked)}
                    className="w-4 h-4 rounded accent-primary-500" />
                  <span className="font-sans text-sm text-charcoal-600">Controlar stock</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-sans font-semibold text-charcoal-700">Estado</h2>
            {[
              { key: 'isActive',   label: 'Activo (visible en tienda)' },
              { key: 'isFeatured', label: 'Destacado en home' },
              { key: 'isOnSale',   label: 'En oferta' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={(form as any)[key]}
                  onChange={e => set(key, e.target.checked)}
                  className="w-4 h-4 rounded accent-primary-500" />
                <span className="font-sans text-sm text-charcoal-600">{label}</span>
              </label>
            ))}
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-sans font-semibold text-charcoal-700">Clasificación</h2>
            <div>
              <label className={labelCls}>Categoría *</label>
              <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)}
                required className={fieldCls}>
                <option value="">Seleccionar...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Marca</label>
              <select value={form.brandId} onChange={e => set('brandId', e.target.value)}
                className={fieldCls}>
                <option value="">Sin marca</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Peso (kg)</label>
              <input type="number" value={form.weight} onChange={e => set('weight', e.target.value)}
                min="0" step="0.001" placeholder="0.350" className={fieldCls} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-60 py-3">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </div>
    </form>
  );
}
