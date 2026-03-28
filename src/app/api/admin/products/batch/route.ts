/**
 * POST /api/admin/products/batch
 * Batch operations on products: activate, deactivate, delete
 *
 * Body: { action: 'activate' | 'deactivate' | 'delete', ids?: string[], all?: boolean }
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, badRequest, serverError } from '@/lib/utils/api';

const BatchSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'delete']),
  ids:    z.array(z.string()).optional(),
  all:    z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const { user, error } = await withAdmin(req);
  if (error) return error;

  try {
    const { action, ids, all } = BatchSchema.parse(await req.json());

    if (!all && (!ids || ids.length === 0)) {
      return badRequest('Debes especificar ids[] o all:true');
    }

    const where = all ? {} : { id: { in: ids! } };

    let count = 0;

    if (action === 'activate') {
      const res = await prisma.product.updateMany({ where, data: { isActive: true } });
      count = res.count;
    } else if (action === 'deactivate') {
      const res = await prisma.product.updateMany({ where, data: { isActive: false } });
      count = res.count;
    } else if (action === 'delete') {
      const res = await prisma.product.deleteMany({ where });
      count = res.count;
    }

    return ok({ action, count, message: `${count} producto(s) ${action === 'activate' ? 'activados' : action === 'deactivate' ? 'desactivados' : 'eliminados'}` });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos', e.errors);
    return serverError(e);
  }
}
