/**
 * GET /api/admin/debug
 * Only available in development. Returns auth state for diagnosing 403.
 * Call from browser: fetch('/api/admin/debug', { credentials: 'include' })
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyAccessToken, getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const token = getTokenFromRequest(req);
  const result: Record<string, unknown> = {
    hasToken: !!token,
    tokenSource: null as string | null,
    jwtPayload: null as unknown,
    dbUser: null as unknown,
    authMethod: 'none',
  };

  if (token) {
    const authHeader = req.headers.get('authorization');
    result.tokenSource = authHeader?.startsWith('Bearer ') ? 'Authorization header' : 'httpOnly cookie';
    result.authMethod = result.tokenSource as string;

    const payload = await verifyAccessToken(token);
    if (payload) {
      result.jwtPayload = { userId: payload.userId, email: payload.email, role: payload.role };

      const user = await getAuthUser(req);
      if (user) {
        result.dbUser = { id: user.id, email: user.email, role: user.role };
        result.roleMatch = user.role === payload.role;
        result.isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
        result.diagnosis = result.isAdmin ? '✅ Should have admin access' : `❌ Role "${user.role}" is not an admin role`;
      } else {
        result.dbUser = 'NOT FOUND OR INACTIVE';
        result.diagnosis = '❌ User not found in DB or isActive=false';
      }
    } else {
      result.diagnosis = '❌ JWT invalid or expired — log in again';
    }
  } else {
    result.diagnosis = '❌ No token found (check cookie or Authorization header)';
  }

  return NextResponse.json(result, { status: 200 });
}
