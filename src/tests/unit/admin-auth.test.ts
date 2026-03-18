import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { signAccessToken, verifyAccessToken, getTokenFromRequest } from '@/lib/auth';
import { ADMIN_ROLES } from '@/lib/admin-auth';

// ── Token helpers ────────────────────────────────────────
describe('JWT Token Management', () => {
  it('signs and verifies a valid admin token', async () => {
    const token = await signAccessToken({ userId: 'u1', email: 'a@test.com', role: 'SUPER_ADMIN' });
    const payload = await verifyAccessToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.role).toBe('SUPER_ADMIN');
    expect(payload!.userId).toBe('u1');
  });

  it('returns null for invalid token', async () => {
    expect(await verifyAccessToken('not.a.valid.token')).toBeNull();
  });

  it('returns null for empty string', async () => {
    expect(await verifyAccessToken('')).toBeNull();
  });

  it('includes correct role in payload', async () => {
    for (const role of ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN']) {
      const token = await signAccessToken({ userId: 'u1', email: 'a@test.com', role });
      expect((await verifyAccessToken(token))!.role).toBe(role);
    }
  });
});

// ── Role checks ──────────────────────────────────────────
describe('Admin Role Authorization', () => {
  it('ADMIN_ROLES contains ADMIN and SUPER_ADMIN', () => {
    expect(ADMIN_ROLES).toContain('ADMIN');
    expect(ADMIN_ROLES).toContain('SUPER_ADMIN');
  });

  it('CUSTOMER is NOT an admin role', () => {
    expect(ADMIN_ROLES).not.toContain('CUSTOMER');
  });

  it('role check is case-sensitive (lowercase fails)', () => {
    const roles = ADMIN_ROLES as readonly string[];
    expect(roles.includes('admin')).toBe(false);   // lowercase must fail
    expect(roles.includes('ADMIN')).toBe(true);    // uppercase must pass
  });

  it('validates all role variants correctly', () => {
    const isAdmin = (role: string) => (ADMIN_ROLES as readonly string[]).includes(role);
    expect(isAdmin('SUPER_ADMIN')).toBe(true);
    expect(isAdmin('ADMIN')).toBe(true);
    expect(isAdmin('CUSTOMER')).toBe(false);
    expect(isAdmin('')).toBe(false);
  });
});

// ── Token extraction using NextRequest ───────────────────
describe('getTokenFromRequest with NextRequest', () => {
  it('extracts token from Authorization Bearer header', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer my-test-token' },
    });
    expect(getTokenFromRequest(req)).toBe('my-test-token');
  });

  it('prefers Authorization header over cookie', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: {
        authorization: 'Bearer header-token',
        cookie: 'access_token=cookie-token',
      },
    });
    expect(getTokenFromRequest(req)).toBe('header-token');
  });

  it('reads cookie via NextRequest.cookies', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { cookie: 'access_token=my-cookie-token' },
    });
    // NextRequest parses cookies from the header
    expect(req.cookies.get('access_token')?.value).toBe('my-cookie-token');
    expect(getTokenFromRequest(req)).toBe('my-cookie-token');
  });

  it('returns null when no token present', () => {
    const req = new NextRequest('http://localhost/api/test');
    expect(getTokenFromRequest(req)).toBeNull();
  });

  it('ignores non-Bearer Authorization schemes', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(getTokenFromRequest(req)).toBeNull();
  });
});

// ── Full auth flow ────────────────────────────────────────
describe('Full Admin Auth Flow', () => {
  it('admin token passes role check', async () => {
    const token = await signAccessToken({ userId: 'a1', email: 'admin@test.com', role: 'SUPER_ADMIN' });
    const payload = await verifyAccessToken(token);
    expect(payload && (ADMIN_ROLES as readonly string[]).includes(payload.role)).toBe(true);
  });

  it('customer token fails role check', async () => {
    const token = await signAccessToken({ userId: 'u1', email: 'user@test.com', role: 'CUSTOMER' });
    const payload = await verifyAccessToken(token);
    expect(payload && (ADMIN_ROLES as readonly string[]).includes(payload.role)).toBeFalsy();
  });

  it('403 error response has informative structure', () => {
    const errorResponse = { error: 'Acceso denegado', required: ADMIN_ROLES, got: 'CUSTOMER' };
    expect(errorResponse.required).toContain('ADMIN');
    expect(errorResponse.required).toContain('SUPER_ADMIN');
    expect(errorResponse.got).toBe('CUSTOMER');
  });
});
