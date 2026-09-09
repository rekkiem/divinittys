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
    const lowStock = searchParams.get('lowStock') === '1';

    const where: any = {};
    if (q) {
      where.product = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    let inventory = await prisma.inventory.findMany({
      where,
      orderBy: { stock: 'asc' },
      take: MAX_EXPORT + 1,
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    if (inventory.length > MAX_EXPORT) {
      return badRequest(
        `Demasiados registros. Aplica filtros; máximo ${MAX_EXPORT} por export.`
      );
    }

    if (lowStock) {
      inventory = inventory.filter((i) => i.trackStock && i.stock <= i.lowStockThreshold);
    }

    const rows = inventory.map((inv) => {
      const status =
        inv.stock === 0
          ? 'Sin stock'
          : inv.stock <= inv.lowStockThreshold
            ? 'Stock bajo'
            : 'OK';
      return {
        productName: inv.product.name,
        sku: inv.product.sku,
        category: inv.product.category?.name ?? '',
        stock: inv.stock,
        reservedStock: inv.reservedStock,
        lowStockThreshold: inv.lowStockThreshold,
        trackStock: inv.trackStock ? 'Sí' : 'No',
        status,
        updatedAt: inv.updatedAt.toISOString(),
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `stock-divinittys-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
