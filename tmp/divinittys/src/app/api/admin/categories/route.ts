import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { created, badRequest, serverError } from '@/lib/utils/api';

export async function POST(req: NextRequest) {
  const { user, error } = await withAdmin(req);
  if (error) return error;
  try {
    const { name, slug } = z.object({ name: z.string().min(1), slug: z.string().min(1) }).parse(await req.json());
    const existing = await prisma.category.findFirst({ where: { OR: [{ name }, { slug }] } });
    if (existing) return badRequest('Ya existe una categoría con ese nombre o slug');
    const category = await prisma.category.create({ data: { name, slug } });
    return created({ category });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos');
    return serverError(e);
  }
}
