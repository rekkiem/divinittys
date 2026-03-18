/**
 * src/lib/admin-auth.ts
 * Middleware centralizado para rutas de administración.
 * Usar en todos los handlers bajo /api/admin/*
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

/**
 * Verifica que la request venga de un admin.
 * Primero verifica JWT (rápido, sin query DB), luego confirma usuario en DB.
 * Retorna el usuario o una NextResponse de error.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<AdminUser | NextResponse> {
  // Step 1: fast JWT check (no DB hit)
  const token = getTokenFromRequest(req);
  if (!token) {
    return NextResponse.json(
      { error: 'No autorizado — token no encontrado', hint: 'Asegúrate de estar autenticado como admin' },
      { status: 401 }
    );
  }

  const jwtPayload = await verifyAccessToken(token);
  if (!jwtPayload) {
    return NextResponse.json(
      { error: 'Token inválido o expirado', hint: 'Inicia sesión nuevamente' },
      { status: 401 }
    );
  }

  if (!ADMIN_ROLES.includes(jwtPayload.role as AdminRole)) {
    return NextResponse.json(
      { error: 'Acceso denegado', required: ADMIN_ROLES, got: jwtPayload.role },
      { status: 403 }
    );
  }

  // Step 2: verify user still active in DB
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Usuario no encontrado o inactivo' },
      { status: 403 }
    );
  }

  if (!ADMIN_ROLES.includes(user.role as AdminRole)) {
    return NextResponse.json(
      { error: 'Acceso denegado — rol insuficiente', required: ADMIN_ROLES, got: user.role },
      { status: 403 }
    );
  }

  return user as AdminUser;
}

/**
 * Type guard: diferencia AdminUser de NextResponse
 */
export function isAdminUser(result: AdminUser | NextResponse): result is AdminUser {
  return !(result instanceof NextResponse);
}

/**
 * Helper de uso simplificado en handlers:
 *
 * export async function POST(req: NextRequest) {
 *   const auth = await withAdmin(req);
 *   if (auth.error) return auth.error;
 *   // auth.user es AdminUser
 * }
 */
export async function withAdmin(req: NextRequest) {
  const result = await requireAdmin(req);
  if (result instanceof NextResponse) {
    return { user: null, error: result } as const;
  }
  return { user: result, error: null } as const;
}
