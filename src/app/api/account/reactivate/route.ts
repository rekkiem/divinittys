import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, badRequest, serverError } from '@/lib/utils/api';
import { sanitizeEmail } from '@/lib/security/sanitize';
import { signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ReactivateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/account/reactivate
 * Reactiva una cuenta inactiva (isActive=false) con email + password.
 * Usuarios solo-OAuth deben contactar soporte o usar flujo admin.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = ReactivateSchema.parse(body);
    const email = sanitizeEmail(data.email);

    const user = await prisma.user.findFirst({
      where: { email, role: 'CUSTOMER' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!user) return unauthorized('Credenciales inválidas');
    if (user.isActive) {
      return badRequest('La cuenta ya está activa. Inicia sesión normalmente.');
    }
    if (!user.passwordHash) {
      return badRequest(
        'Esta cuenta se registró con Google. Contacta a contacto@divinittys.cl para reactivarla.'
      );
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return unauthorized('Credenciales inválidas');

    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true },
    });

    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await signRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: req.headers.get('user-agent') || undefined,
        ipAddress:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('x-real-ip') ||
          undefined,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const res = ok({
      message: 'Cuenta reactivada correctamente',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
      accessToken,
    });
    setAuthCookies(res as NextResponse, accessToken, refreshToken);
    return res;
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos', e.errors);
    return serverError(e);
  }
}
