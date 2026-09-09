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

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { guestEmail: { contains: q, mode: 'insensitive' } },
        { guestName: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const total = await prisma.order.count({ where });
    if (total > MAX_EXPORT) {
      return badRequest(
        `Demasiados registros (${total}). Aplica filtros; máximo ${MAX_EXPORT} por export.`
      );
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT,
      include: {
        user: { select: { name: true, email: true } },
        items: { select: { id: true, name: true, quantity: true, total: true } },
        payment: { select: { status: true, provider: true } },
      },
    });

    const rows = orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.payment?.status ?? '',
      paymentProvider: o.payment?.provider ?? '',
      customerName: o.user?.name || o.guestName || '',
      customerEmail: o.user?.email || o.guestEmail || '',
      itemsCount: o.items.length,
      subtotal: Number(o.subtotal),
      shippingAmount: Number(o.shippingAmount),
      discountAmount: Number(o.discountAmount),
      total: Number(o.total),
      createdAt: o.createdAt.toISOString(),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `pedidos-divinittys-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
