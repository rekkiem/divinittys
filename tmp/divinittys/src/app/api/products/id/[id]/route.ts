import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, forbidden, notFound, serverError } from '@/lib/utils/api';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;
  return user;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return forbidden('Acceso denegado');
    const body = await req.json();
    const product = await prisma.product.update({ where: { id: params.id }, data: body });
    return ok(product);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return forbidden('Acceso denegado');
    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) return notFound('Producto no encontrado');
    await prisma.product.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
