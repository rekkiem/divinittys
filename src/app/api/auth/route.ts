import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import {
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  verifyRefreshToken,
  getTokenFromRequest,
  verifyAccessToken,
} from '@/lib/auth';
import { ok, badRequest, unauthorized, serverError, conflict } from '@/lib/utils/api';
import { emailQueue } from '@/lib/queue/email.queue';

// ---- Register ----
const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe tener al menos una mayúscula, una minúscula y un número',
  }),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'login';

  try {
    if (action === 'register') {
      const body = await req.json();
      const data = registerSchema.parse(body);

      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) return conflict('El email ya está registrado');

      const passwordHash = await bcrypt.hash(data.password, 12);
      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          phone: data.phone,
        },
        select: { id: true, email: true, name: true, role: true },
      });

      const accessToken = await signAccessToken({ userId: user.id, email: user.email, role: user.role });
      const refreshToken = await signRefreshToken({ userId: user.id, email: user.email, role: user.role });

      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken,
          userAgent: req.headers.get('user-agent') || undefined,
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      await emailQueue.add('welcome', { email: user.email });

      const res = ok({ user, accessToken });
      setAuthCookies(res as NextResponse, accessToken, refreshToken);
      return res;
    }

    if (action === 'login') {
      const body = await req.json();
      const { email, password } = z.object({
        email: z.string().email(),
        password: z.string(),
      }).parse(body);

      const user = await prisma.user.findUnique({ where: { email, isActive: true } });
      if (!user) return unauthorized('Credenciales inválidas');

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return unauthorized('Credenciales inválidas');

      const accessToken = await signAccessToken({ userId: user.id, email: user.email, role: user.role });
      const refreshToken = await signRefreshToken({ userId: user.id, email: user.email, role: user.role });

      await prisma.session.upsert({
        where: { refreshToken },
        update: { refreshToken, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        create: {
          userId: user.id,
          refreshToken,
          userAgent: req.headers.get('user-agent') || undefined,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.user.update({ where: { id: user.id }, data: { lastActivityAt: new Date() } });

      const userData = { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar };
      const res = ok({ user: userData, accessToken });
      setAuthCookies(res as NextResponse, accessToken, refreshToken);
      return res;
    }

    if (action === 'logout') {
      const token = getTokenFromRequest(req);
      if (token) {
        const payload = await verifyAccessToken(token);
        if (payload) {
          await prisma.session.deleteMany({ where: { userId: payload.userId } });
        }
      }
      const res = ok({ message: 'Sesión cerrada' });
      clearAuthCookies(res as NextResponse);
      return res;
    }

    if (action === 'refresh') {
      const refreshToken = req.cookies.get('refresh_token')?.value;
      if (!refreshToken) return unauthorized();

      const payload = await verifyRefreshToken(refreshToken);
      if (!payload) return unauthorized('Token expirado');

      const session = await prisma.session.findUnique({ where: { refreshToken } });
      if (!session || session.expiresAt < new Date()) return unauthorized();

      const accessToken = await signAccessToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });

      const res = ok({ accessToken });
      res.cookies.set('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });
      return res;
    }

    if (action === 'me') {
      const token = getTokenFromRequest(req);
      if (!token) return unauthorized();

      const payload = await verifyAccessToken(token);
      if (!payload) return unauthorized();

      const user = await prisma.user.findUnique({
        where: { id: payload.userId, isActive: true },
        select: { id: true, email: true, name: true, role: true, avatar: true, phone: true },
      });

      if (!user) return unauthorized();
      return ok({ user });
    }

    return badRequest('Acción no válida');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest('Datos inválidos', error.errors);
    }
    return serverError(error);
  }
}
