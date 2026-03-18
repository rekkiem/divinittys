import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, notFound, serverError } from '@/lib/utils/api';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await withAdmin(req);
  if (error) return error;
  try {
    const body = await req.json();
    const product = await prisma.product.update({ where: { id: params.id }, data: body });
    return ok(product);
  } catch (e) { return serverError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await withAdmin(req);
  if (error) return error;
  try {
    const p = await prisma.product.findUnique({ where: { id: params.id } });
    if (!p) return notFound('Producto no encontrado');
    await prisma.product.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (e) { return serverError(e); }
}
