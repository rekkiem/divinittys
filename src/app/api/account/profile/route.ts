import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, unauthorized, badRequest, serverError } from '@/lib/utils/api';
import { sanitizeText } from '@/lib/security/sanitize';

export const dynamic = 'force-dynamic';

const ProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  // email intentionally omitted — immutable for the client
});

/**
 * PATCH /api/account/profile
 * Cliente puede editar nombre y teléfono. Email es inmutable.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const body = await req.json();
    const data = ProfileSchema.parse(body);

    if (data.name === undefined && data.phone === undefined) {
      return badRequest('No hay campos para actualizar');
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.name !== undefined ? { name: sanitizeText(data.name) } : {}),
        ...(data.phone !== undefined
          ? { phone: data.phone ? sanitizeText(data.phone) : null }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatar: true,
        isActive: true,
      },
    });

    return ok({ user: updated });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos de perfil inválidos', e.errors);
    return serverError(e);
  }
}

/**
 * GET /api/account/profile — datos completos del perfil autenticado
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const full = await prisma.user.findFirst({
      where: { id: user.id, isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatar: true,
        image: true,
        isActive: true,
        createdAt: true,
        _count: { select: { addresses: true, orders: true } },
      },
    });

    if (!full) return unauthorized();
    return ok({ user: full });
  } catch (e) {
    return serverError(e);
  }
}
