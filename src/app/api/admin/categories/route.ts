import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { created, badRequest, forbidden, serverError } from '@/lib/utils/api';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || !['ADMIN','SUPER_ADMIN'].includes(user.role)) return null;
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return forbidden();
    const { name, slug } = z.object({ name: z.string().min(1), slug: z.string().min(1) }).parse(await req.json());
    const existing = await prisma.category.findFirst({ where: { OR: [{ name }, { slug }] } });
    if (existing) return badRequest('Ya existe una categoría con ese nombre');
    const category = await prisma.category.create({ data: { name, slug } });
    return created({ category });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos');
    return serverError(e);
  }
}
