/**
 * /api/auth/google-callback
 *
 * Tras el redirect de NextAuth (Google), este endpoint:
 * 1. Verifica la sesión de Auth.js
 * 2. Busca/crea el usuario en nuestra DB (ya lo hace el adapter)
 * 3. Emite access_token + refresh_token (nuestro sistema JWT)
 * 4. Setea las cookies httpOnly
 * 5. Redirige a /cuenta (o ?callbackUrl)
 *
 * Flujo recomendado desde el botón:
 *   signIn('google', { callbackUrl: '/api/auth/google-callback' })
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { prisma } from '@/lib/prisma';
import {
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
} from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/cuenta/login?error=google_auth_failed', req.url));
  }

  const email = session.user.email;
  const name = session.user.name ?? email.split('@')[0];
  const avatar = session.user.image ?? null;

  // Buscar o crear usuario (el adapter ya debería haberlo creado, pero por seguridad)
  let user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, avatar: true, isActive: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        avatar,
        emailVerified: new Date(),
        role: 'CUSTOMER',
        // passwordHash es opcional (nullable)
      },
      select: { id: true, email: true, name: true, role: true, avatar: true, isActive: true },
    });
  } else if (!user.isActive) {
    return NextResponse.redirect(new URL('/cuenta/login?error=account_disabled', req.url));
  } else {
    // Actualizar avatar/nombre si vienen de Google y están vacíos
    const updates: { name?: string; avatar?: string | null; emailVerified?: Date } = {};
    if (!user.name && name) updates.name = name;
    if (!user.avatar && avatar) updates.avatar = avatar;
    if (Object.keys(updates).length) {
      updates.emailVerified = new Date();
      user = await prisma.user.update({
        where: { id: user.id },
        data: updates,
        select: { id: true, email: true, name: true, role: true, avatar: true, isActive: true },
      });
    }
  }

  // Emitir tokens JWT propios (mismo sistema que email/password)
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

  // Guardar sesión en nuestra tabla sessions
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    undefined;

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      userAgent: req.headers.get('user-agent') || undefined,
      ipAddress,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Redirección final
  const callbackUrl = req.nextUrl.searchParams.get('callbackUrl') || '/cuenta';
  const safeCallback =
    callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
      ? callbackUrl
      : '/cuenta';

  const res = NextResponse.redirect(new URL(safeCallback, req.url));
  setAuthCookies(res, accessToken, refreshToken);

  // Flag temporal para que el client hidrate el store
  res.cookies.set('auth_just_logged_in', '1', {
    httpOnly: false,
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
  });

  return res;
}
