import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, forbidden, serverError, badRequest } from '@/lib/utils/api';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || !['ADMIN','SUPER_ADMIN'].includes(user.role)) return null;
  return user;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return forbidden();
    const data = z.object({ name: z.string().optional(), slug: z.string().optional(), isActive: z.boolean().optional() }).parse(await req.json());
    const category = await prisma.category.update({ where: { id: params.id }, data });
    return ok({ category });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos');
    return serverError(e);
  }
}
