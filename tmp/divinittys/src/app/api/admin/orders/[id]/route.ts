import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, forbidden, serverError, badRequest } from '@/lib/utils/api';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;
  return user;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return forbidden();
    const { status } = z.object({
      status: z.enum(['PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED']),
    }).parse(await req.json());
    const order = await prisma.order.update({ where: { id: params.id }, data: { status } });
    return ok({ order });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Estado inválido');
    return serverError(e);
  }
}
