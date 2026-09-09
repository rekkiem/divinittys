import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import {
  badRequest,
  ok,
  serverError,
  validationError,
} from '@/lib/utils/api';

export const dynamic = 'force-dynamic';

const schema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(128),
});

/**
 * POST /api/admin/me/password
 * Cambia la contraseña del admin autenticado.
 * Verifica la actual, hashea la nueva, invalida todas las sesiones.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await withAdmin(req);
  if (error || !user) return error!;

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { currentPassword, newPassword } = parsed.data;

    const dbUser = await prisma.user.findFirst({
      where: { id: user.id, isActive: true },
      select: { id: true, passwordHash: true },
    });

    if (!dbUser?.passwordHash) {
      return badRequest(
        'Esta cuenta no tiene contraseña local (posible login solo OAuth). Contacta a un SUPER_ADMIN.'
      );
    }

    const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!valid) {
      return badRequest('La contraseña actual no es correcta');
    }

    if (currentPassword === newPassword) {
      return badRequest('La nueva contraseña debe ser distinta a la actual');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      // Cerrar todas las sesiones del usuario
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    return ok({
      message: 'Contraseña actualizada. Todas las sesiones fueron cerradas.',
    });
  } catch (e) {
    return serverError(e);
  }
}
