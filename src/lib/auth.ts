/**
 * src/lib/auth.ts
 * Autenticación JWT + helpers de autorización
 *
 * FIX CRÍTICO: prisma.user.findUnique() con { id, isActive } es inválido —
 * findUnique solo acepta campos @unique. Usar findFirst() con ambos filtros.
 */
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { env } from './env';

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);
const JWT_REFRESH_SECRET = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export type JWTPayload = {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
};

export async function signAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
}

export async function signRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_EXPIRES_IN)
    .sign(JWT_REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET);
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  // 1. Authorization: Bearer <token>  (preferred — sent by client fetch)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);
  // 2. httpOnly cookie (set by login API)
  const cookie = req.cookies.get('access_token');
  if (cookie?.value) return cookie.value;
  return null;
}

/**
 * Obtiene el usuario autenticado desde la request.
 * FIX: usa findFirst (no findUnique) para aceptar filtros compuestos.
 * Además, verifica el rol directamente del JWT para evitar una query extra
 * cuando solo se necesita saber si es admin.
 */
export async function getAuthUser(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  // FIX: findFirst en lugar de findUnique para poder filtrar por isActive
  const user = await prisma.user.findFirst({
    where: { id: payload.userId, isActive: true },
    select: { id: true, email: true, name: true, role: true, avatar: true },
  });

  return user;
}

/**
 * getAuthUserFromToken: versión rápida que usa solo el JWT sin query a DB.
 * Útil para checks de rol en rutas de alta frecuencia.
 */
export async function getAuthUserFromToken(req: NextRequest): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyAccessToken(token);
}

/** Middleware helper reusable */
export function requireAuth(roles?: string[]) {
  return async (req: NextRequest) => {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (roles && !roles.includes(user.role)) {
      return NextResponse.json({ error: 'Acceso denegado', required: roles, got: user.role }, { status: 403 });
    }
    return user;
  };
}

export function setAuthCookies(res: NextResponse, accessToken: string, refreshToken: string) {
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  res.cookies.set('access_token',  accessToken,  { ...cookieOpts, maxAge: 7  * 24 * 60 * 60 });
  res.cookies.set('refresh_token', refreshToken, { ...cookieOpts, maxAge: 30 * 24 * 60 * 60 });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.delete('access_token');
  res.cookies.delete('refresh_token');
}
