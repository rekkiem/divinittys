/**
 * POST /api/oauth/exchange
 *
 * Si el usuario ya tiene sesión Auth.js (cookie tras Google) pero aún no
 * tiene nuestras cookies JWT, las emite aquí.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { prisma } from '@/lib/prisma';
import {
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
} from '@/lib/auth';
import { ok, unauthorized, serverError } from '@/lib/utils/api';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return unauthorized('Sin sesión Google');
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
      return unauthorized('Cuenta desactivada');
    } else if (!user.avatar && avatar) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { avatar, image: avatar, emailVerified: new Date() },
        select: { id: true, email: true, name: true, role: true, avatar: true, isActive: true },
      });
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

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
    };

    const res = ok({ user: userData, accessToken });
    setAuthCookies(res as NextResponse, accessToken, refreshToken);
    return res;
  } catch (e) {
    console.error('[oauth/exchange]', e);
    return serverError(e);
  }
}
