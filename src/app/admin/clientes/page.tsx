export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import ClientesTableClient from './ClientesTableClient';
import AdminPagination from '@/components/admin/AdminPagination';
import ExportExcelButton from '@/components/admin/ExportExcelButton';

const ALLOWED_LIMITS = new Set([50, 100]);

async function getClients(page: number, limit: number, q?: string, status?: string) {
  const skip = (page - 1) * limit;
  const where: any = { role: 'CUSTOMER' };

  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true, addresses: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    clients: rows.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { page?: string; limit?: string; q?: string; status?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const rawLimit = parseInt(searchParams.limit || '50', 10) || 50;
  const limit = ALLOWED_LIMITS.has(rawLimit) ? rawLimit : 50;
  const q = (searchParams.q || '').trim();
  const status = (searchParams.status || 'all').trim();

  const { clients, total, totalPages } = await getClients(
    page,
    limit,
    q || undefined,
    status !== 'all' ? status : undefined
  );

  const exportQuery = new URLSearchParams();
  if (q) exportQuery.set('q', q);
  if (status && status !== 'all') exportQuery.set('status', status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium text-charcoal-700">Clientes</h1>
          <p className="font-sans text-muted-foreground mt-1">
            {total} cliente{total !== 1 ? 's' : ''} registrados
            {q ? ` · filtro "${q}"` : ''}
          </p>
        </div>
        <ExportExcelButton
          endpoint="/api/admin/clients/export"
          query={exportQuery.toString()}
          filename="clientes-divinittys.xlsx"
        />
      </div>

      <form method="get" className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px] max-w-md">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, email o teléfono…"
            className="input-field text-sm py-2 w-full"
          />
        </div>
        <select name="status" defaultValue={status} className="input-field text-sm py-2 w-auto">
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <input type="hidden" name="limit" value={limit} />
        <button type="submit" className="btn-secondary text-sm px-4 py-2">
          Filtrar
        </button>
      </form>

      <ClientesTableClient initialClients={clients} />

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        preserveKeys={['q', 'status']}
      />
    </div>
  );
}
