/**
 * src/lib/admin-auth.ts
 * Centralized admin authorization middleware.
 *
 * DESIGN: Always verifies role from DATABASE (not JWT) to ensure role changes
 * take effect immediately. Never trusts JWT role field alone.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyAccessToken, getAuthUser } from './auth';

export const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatar: string | null;
};

export async function requireAdmin(req: NextRequest): Promise<AdminUser | NextResponse> {
  const token = getTokenFromRequest(req);

  if (!token) {
    return NextResponse.json(
      {
        error: 'No autorizado — sesión no encontrada',
        hint: 'Cierra sesión y vuelve a iniciar en /cuenta/login',
        code: 'NO_TOKEN',
      },
      { status: 401 }
    );
  }

  const jwtPayload = await verifyAccessToken(token);
  if (!jwtPayload) {
    return NextResponse.json(
      {
        error: 'Sesión expirada o inválida',
        hint: 'Cierra sesión y vuelve a iniciar en /cuenta/login',
        code: 'INVALID_TOKEN',
      },
      { status: 401 }
    );
  }

  // Always verify from DB (source of truth)
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json(
      {
        error: 'Usuario no encontrado o inactivo',
        hint: 'La sesión puede estar desactualizada. Cierra sesión, limpia el caché del navegador y vuelve a iniciar sesión. Si el problema persiste ejecuta: curl -X POST http://localhost:3000/api/admin/fix-seed',
        code: 'USER_NOT_FOUND',
        userId: jwtPayload.userId,  // helps debug which user is failing
      },
      { status: 403 }
    );
  }

  if (!(ADMIN_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json(
      {
        error: 'Acceso denegado — rol insuficiente',
        required: ADMIN_ROLES,
        got: user.role,
        hint: 'Cierra sesión y vuelve a iniciar sesión para actualizar el token',
        code: 'INSUFFICIENT_ROLE',
      },
      { status: 403 }
    );
  }

  return user as AdminUser;
}

export function isAdminUser(result: AdminUser | NextResponse): result is AdminUser {
  return !(result instanceof NextResponse);
}

export async function withAdmin(req: NextRequest) {
  const result = await requireAdmin(req);
  if (result instanceof NextResponse) {
    return { user: null, error: result } as const;
  }
  return { user: result, error: null } as const;
}
