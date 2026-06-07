import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, serverError, badRequest, slugify } from '@/lib/utils/api';
import { sanitizeText } from '@/lib/security/sanitize';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await withAdmin(req);
  if (error) return error;
  try {
    const parsed = z.object({
      name: z.string().optional(), slug: z.string().optional(), isActive: z.boolean().optional(),
    }).parse(await req.json());
    const data = {
      ...parsed,
      name: parsed.name ? sanitizeText(parsed.name) : undefined,
      slug: parsed.slug ? slugify(parsed.slug) : undefined,
    };
    const category = await prisma.category.update({ where: { id: params.id }, data });
    return ok({ category });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos');
    return serverError(e);
  }
}
