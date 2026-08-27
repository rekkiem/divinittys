/**
 * /api/auth/google-callback
 *
 * Tras el redirect de NextAuth (Google):
 * 1. Verifica la sesión de Auth.js
 * 2. Busca/crea el usuario en nuestra DB
 * 3. Emite access_token + refresh_token (JWT propio)
 * 4. Setea cookies httpOnly
 * 5. Redirige a /cuenta (URL pública, nunca 0.0.0.0)
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { prisma } from '@/lib/prisma';
import {
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
} from '@/lib/auth';

function publicOrigin(req: NextRequest): string {
  const fromEnv =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && !fromEnv.includes('0.0.0.0')) {
    return fromEnv.replace(/\/$/, '');
  }
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host && !host.startsWith('0.0.0.0') && !host.startsWith('localhost')) {
    return `${proto}://${host}`;
  }
  return 'https://prep.divinittys.cl';
}

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.redirect(`${origin}/cuenta/login?error=google_auth_failed`);
  }

  const email = session.user.email;
  const name = session.user.name ?? email.split('@')[0];
  const avatar = session.user.image ?? null;

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
        image: avatar,
        emailVerified: new Date(),
        role: 'CUSTOMER',
      },
      select: { id: true, email: true, name: true, role: true, avatar: true, isActive: true },
    });
  } else if (!user.isActive) {
    return NextResponse.redirect(`${origin}/cuenta/login?error=account_disabled`);
  } else {
    const updates: { name?: string; avatar?: string | null; image?: string | null; emailVerified?: Date } = {};
    if (!user.name && name) updates.name = name;
    if (!user.avatar && avatar) {
      updates.avatar = avatar;
      updates.image = avatar;
    }
    if (Object.keys(updates).length) {
      updates.emailVerified = new Date();
      user = await prisma.user.update({
        where: { id: user.id },
        data: updates,
        select: { id: true, email: true, name: true, role: true, avatar: true, isActive: true },
      });
    }
  }

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

  const callbackUrl = req.nextUrl.searchParams.get('callbackUrl') || '/cuenta';
  const safePath =
    callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
      ? callbackUrl
      : '/cuenta';

  const res = NextResponse.redirect(`${origin}${safePath}`);
  setAuthCookies(res, accessToken, refreshToken);

  res.cookies.set('auth_just_logged_in', '1', {
    httpOnly: false,
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
    secure: true,
  });

  return res;
}
