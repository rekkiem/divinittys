import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, badRequest, serverError } from '@/lib/utils/api';
import { getAuthUser, clearAuthCookies } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DeactivateSchema = z.object({
  confirmation: z.literal('ELIMINAR'),
});

/**
 * POST /api/account/deactivate
 * Baja lógica: isActive = false. Cierra sesiones. No borra datos.
 * Solo el admin puede eliminar físicamente (y solo sin pedidos).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const parsed = DeactivateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Debes confirmar escribiendo ELIMINAR');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    const res = ok({
      message:
        'Tu cuenta ha sido desactivada. Puedes reactivarla iniciando sesión con el mismo email si aún tienes credenciales, o contactando soporte.',
    });
    clearAuthCookies(res as NextResponse);
    return res;
  } catch (e) {
    return serverError(e);
  }
}
