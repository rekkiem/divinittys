'use client';

import { useState } from 'react';
import { Save, Loader2, Store, Mail, Phone, MapPin, Truck, Shield, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/hooks/useAuth';
import { formatCLP } from '@/lib/utils/api';

type Settings = Record<string, string>;

const FIELD_GROUPS = [
  {
    title: 'Información de la Tienda', icon: Store,
    fields: [
      { key: 'store_name',        label: 'Nombre de la tienda', placeholder: 'DIVINITTYS', type: 'text' },
      { key: 'store_description', label: 'Descripción',         placeholder: 'E-commerce de productos de belleza', type: 'textarea' },
      { key: 'store_tagline',     label: 'Slogan',              placeholder: 'Tu belleza, nuestra pasión', type: 'text' },
    ],
  },
  {
    title: 'Contacto', icon: Mail,
    fields: [
      { key: 'store_email',   label: 'Email de contacto', placeholder: 'hola@divinittys.cl', type: 'email' },
      { key: 'store_phone',   label: 'Teléfono',          placeholder: '+56 9 xxxx xxxx',    type: 'tel' },
      { key: 'store_address', label: 'Dirección',         placeholder: 'Santiago, Chile',    type: 'text' },
      { key: 'store_instagram', label: 'Instagram',       placeholder: '@divinittys',        type: 'text' },
    ],
  },
  {
    title: 'Envíos', icon: Truck,
    fields: [
      { key: 'free_shipping_threshold', label: 'Envío gratis desde (CLP)', placeholder: '50000', type: 'number' },
      { key: 'shipping_message',        label: 'Mensaje de envío',         placeholder: 'Envíos a todo Chile en 24-48hrs', type: 'text' },
    ],
  },
  {
    title: 'Pagos', icon: CreditCard,
    fields: [
      { key: 'currency',       label: 'Moneda',      placeholder: 'CLP', type: 'text' },
      { key: 'tax_rate',       label: 'IVA (%)',     placeholder: '19',  type: 'number' },
      { key: 'min_order_amount', label: 'Pedido mínimo (CLP)', placeholder: '0', type: 'number' },
    ],
  },
  {
    title: 'Políticas', icon: Shield,
    fields: [
      { key: 'return_policy',  label: 'Política de devoluciones', placeholder: '30 días para devoluciones...', type: 'textarea' },
      { key: 'privacy_policy', label: 'Política de privacidad',   placeholder: 'Tus datos están seguros...', type: 'textarea' },
      { key: 'terms',          label: 'Términos y condiciones',   placeholder: 'Al usar este sitio...', type: 'textarea' },
    ],
  },
  {
    title: 'SEO y Marketing', icon: Store,
    fields: [
      { key: 'meta_title',       label: 'Meta título',       placeholder: 'DIVINITTYS | Belleza Profesional', type: 'text' },
      { key: 'meta_description', label: 'Meta descripción',  placeholder: 'Productos de belleza premium...', type: 'textarea' },
      { key: 'google_analytics', label: 'Google Analytics ID', placeholder: 'G-XXXXXXXXXX', type: 'text' },
    ],
  },
];

export default function ConfiguracionClient({ initialSettings }: { initialSettings: Settings }) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState(false);
  const { accessToken } = useAuthStore();

  const setValue = (key: string, value: string) => {
    setSettings(s => ({ ...s, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
      const res  = await fetch('/api/admin/settings', { method: 'PUT', headers, credentials: 'include', body: JSON.stringify(settings) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      toast.success(`✅ ${data.data.saved} configuraciones guardadas`);
      setDirty(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldCls  = 'input-field text-sm';
  const labelCls  = 'block font-sans text-xs font-semibold text-charcoal-500 mb-1.5 uppercase tracking-wider';

  return (
    <div className="space-y-6">
      {/* Save button */}
      {dirty && (
        <div className="sticky top-0 z-10 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
          <p className="font-sans text-sm text-amber-700 font-medium">Tienes cambios sin guardar</p>
          <button onClick={save} disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm py-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {FIELD_GROUPS.map(({ title, icon: Icon, fields }) => (
        <div key={title} className="bg-white rounded-2xl border border-champagne-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Icon className="w-4 h-4 text-primary-500" />
            <h2 className="font-sans font-semibold text-charcoal-700">{title}</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {fields.map(({ key, label, placeholder, type }) => (
              <div key={key} className={type === 'textarea' ? 'sm:col-span-2' : ''}>
                <label className={labelCls}>{label}</label>
                {type === 'textarea' ? (
                  <textarea value={settings[key] ?? ''} onChange={e => setValue(key, e.target.value)}
                    placeholder={placeholder} rows={3} className={`${fieldCls} resize-none`} />
                ) : (
                  <input type={type} value={settings[key] ?? ''} onChange={e => setValue(key, e.target.value)}
                    placeholder={placeholder} className={fieldCls} />
                )}
                {/* Preview for numeric fields */}
                {type === 'number' && settings[key] && key.includes('threshold') && (
                  <p className="font-sans text-xs text-charcoal-400 mt-1">
                    = {formatCLP(Number(settings[key]))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Save bottom */}
      <button onClick={save} disabled={saving || !dirty}
        className="btn-primary flex items-center gap-2 disabled:opacity-60">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  );
}
