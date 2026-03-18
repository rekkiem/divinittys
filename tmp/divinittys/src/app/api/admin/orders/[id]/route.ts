import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, serverError, badRequest } from '@/lib/utils/api';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await withAdmin(req);
  if (error) return error;
  try {
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
