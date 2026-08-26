import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sanitizeEmail, sanitizeText } from '@/lib/security/sanitize';
import { getRequestIp, rateLimit } from '@/lib/security/rate-limit';
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
  const ipAddress = getRequestIp(req);

  try {
    if (action === 'register') {
      const limit = await rateLimit(req, { key: 'auth-register', limit: 5, windowMs: 15 * 60 * 1000 });
      if (!limit.allowed) {
        return badRequest('Demasiados intentos de registro. Intenta nuevamente en unos minutos.');
      }

      const body = await req.json();
      const parsed = registerSchema.parse(body);
      const data = {
        ...parsed,
        name: sanitizeText(parsed.name),
        email: sanitizeEmail(parsed.email),
        phone: parsed.phone ? sanitizeText(parsed.phone) : undefined,
      };

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
          ipAddress,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const res = ok({ user, accessToken });
      setAuthCookies(res as NextResponse, accessToken, refreshToken);
      return res;
    }

    if (action === 'login') {
      const limit = await rateLimit(req, { key: 'auth-login', limit: 10, windowMs: 15 * 60 * 1000 });
      if (!limit.allowed) {
        return badRequest('Demasiados intentos de inicio de sesión. Espera unos minutos.');
      }

      const body = await req.json();
      const parsed = z
        .object({
          email: z.string().email(),
          password: z.string(),
        })
        .parse(body);
      const email = sanitizeEmail(parsed.email);
      const password = parsed.password;

      const user = await prisma.user.findFirst({ where: { email, isActive: true } });
      if (!user) return unauthorized('Credenciales inválidas');

      // Usuarios creados solo con Google no tienen passwordHash
      if (!user.passwordHash) {
        return unauthorized('Esta cuenta se registró con Google. Usa "Iniciar sesión con Google".');
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return unauthorized('Credenciales inválidas');

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

      // Solo limpia sesiones expiradas (no otras sesiones válidas del usuario)
      await prisma.session.deleteMany({
        where: {
          userId: user.id,
          expiresAt: { lt: new Date() },
        },
      });

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
    }

    if (action === 'logout') {
      // Preferir borrar SOLO la sesión actual (refresh cookie)
      const refreshToken = req.cookies.get('refresh_token')?.value;
      if (refreshToken) {
        await prisma.session.deleteMany({ where: { refreshToken } });
      } else {
        // Fallback: si no hay refresh cookie, intentar por access token (sesión única)
        const token = getTokenFromRequest(req);
        if (token) {
          const payload = await verifyAccessToken(token);
          if (payload) {
            // Sin refresh: no borramos todas las sesiones de todos los dispositivos
            // Solo limpiamos cookies del request actual
          }
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

      const user = await prisma.user.findFirst({
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
