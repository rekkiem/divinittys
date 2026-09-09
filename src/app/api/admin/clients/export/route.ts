import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { badRequest, serverError } from '@/lib/utils/api';

export const dynamic = 'force-dynamic';

const MAX_EXPORT = 10_000;

export async function GET(req: NextRequest) {
  const { user, error } = await withAdmin(req);
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const status = (searchParams.get('status') || '').trim();

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

    const total = await prisma.user.count({ where });
    if (total > MAX_EXPORT) {
      return badRequest(
        `Demasiados registros (${total}). Aplica filtros; máximo ${MAX_EXPORT} por export.`
      );
    }

    const clients = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true, addresses: true } },
      },
    });

    const rows = clients.map((c) => ({
      id: c.id,
      name: c.name ?? '',
      email: c.email,
      phone: c.phone ?? '',
      isActive: c.isActive ? 'Sí' : 'No',
      ordersCount: c._count.orders,
      addressesCount: c._count.addresses,
      createdAt: c.createdAt.toISOString(),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `clientes-divinittys-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
