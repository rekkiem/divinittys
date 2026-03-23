/**
 * src/lib/admin-auth.ts
 * Centralized admin authorization middleware.
 *
 * DESIGN: Always verifies role from DATABASE (not JWT) to ensure:
 * - Role promotions take effect immediately
 * - Role revocations take effect immediately
 * - No stale JWT role mismatches cause 403 false-positives
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
 * requireAdmin: verify request comes from an active admin user.
 *
 * Flow:
 * 1. Validate token exists + is cryptographically valid
 * 2. Fetch user from DB (source of truth for role)
 * 3. Check DB role is ADMIN or SUPER_ADMIN
 *
 * NOTE: We do NOT check JWT role in step 1. This prevents false-403s
 * when a user's DB role was changed after their last login.
 */
export async function requireAdmin(req: NextRequest): Promise<AdminUser | NextResponse> {
  const token = getTokenFromRequest(req);

  if (!token) {
    return NextResponse.json(
      { error: 'No autorizado', hint: 'Inicia sesión en /cuenta/login' },
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

  // Always check role from DB — never trust JWT role for authorization
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Usuario no encontrado o inactivo' },
      { status: 403 }
    );
  }

  if (!(ADMIN_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json(
      {
        error: 'Acceso denegado — rol insuficiente',
        required: ADMIN_ROLES,
        got: user.role,
        hint: 'Si eres administrador, cierra sesión y vuelve a iniciar para actualizar tu token',
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
