import { prisma } from '@/lib/prisma';
import ConfiguracionClient from './ConfiguracionClient';
import AdminSecurityForm from '@/components/admin/AdminSecurityForm';

export const dynamic = 'force-dynamic';

async function getSettings() {
  const rows = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  return Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
}

export default async function ConfiguracionPage() {
  const settings = await getSettings();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-charcoal-700">Configuración</h1>
        <p className="font-sans text-muted-foreground mt-1">
          Parámetros generales de la tienda y seguridad de la cuenta
        </p>
      </div>

      {/* Seguridad del administrador (cambio de contraseña) */}
      <AdminSecurityForm />

      <ConfiguracionClient initialSettings={settings} />
    </div>
  );
}
