/**
 * Integration Tests: Admin Auth Middleware (withAdmin)
 * Updated to reflect DB-first role checking (no JWT fast-path)
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { withAdmin, ADMIN_ROLES } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { makeAdminToken, makeCustomerToken, makeToken, MOCK_USERS } from '@/tests/helpers/auth';

function makeReq(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new NextRequest('http://localhost/api/admin/products', { method: 'POST', headers });
}

describe('withAdmin middleware (DB-first role check)', () => {
  it('returns 401 when no token', async () => {
    const { user, error } = await withAdmin(makeReq());
    expect(user).toBeNull();
    expect(error!.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const { user, error } = await withAdmin(makeReq('bad-token'));
    expect(user).toBeNull();
    expect(error!.status).toBe(401);
  });

  it('returns 403 when DB user not found', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    const { user, error } = await withAdmin(makeReq(token));
    expect(user).toBeNull();
    expect(error!.status).toBe(403);
  });

  it('returns 403 when DB role is CUSTOMER (even if JWT says admin)', async () => {
    // This is the key fix — stale tokens no longer cause issues
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.customer as any);
    const { user, error } = await withAdmin(makeReq(token));
    expect(user).toBeNull();
    expect(error!.status).toBe(403);
    const body = await error!.json();
    expect(body.got).toBe('CUSTOMER');
  });

  it('returns 403 when CUSTOMER token AND CUSTOMER in DB', async () => {
    const token = await makeCustomerToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.customer as any);
    const { user, error } = await withAdmin(makeReq(token));
    expect(user).toBeNull();
    expect(error!.status).toBe(403);
  });

  it('returns user when SUPER_ADMIN in DB (regardless of JWT role)', async () => {
    // Works even if JWT has stale role — DB is source of truth
    const token = await makeCustomerToken(); // stale token with CUSTOMER
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const { user, error } = await withAdmin(makeReq(token));
    // JWT says CUSTOMER but DB says SUPER_ADMIN → should ALLOW (DB is authoritative)
    expect(error).toBeNull();
    expect(user!.role).toBe('SUPER_ADMIN');
  });

  it('returns user when ADMIN in DB', async () => {
    const token = await makeToken('ADMIN', MOCK_USERS.admin.id);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.admin as any);
    const { user, error } = await withAdmin(makeReq(token));
    expect(error).toBeNull();
    expect(user!.role).toBe('ADMIN');
  });

  it('reads token from Authorization header', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const req = new NextRequest('http://localhost/api/admin/products', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const { user, error } = await withAdmin(req);
    expect(error).toBeNull();
    expect(user).not.toBeNull();
  });

  it('reads token from cookie fallback', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const req = new NextRequest('http://localhost/api/admin/products', {
      method: 'POST', headers: { cookie: `access_token=${token}` },
    });
    const { user, error } = await withAdmin(req);
    expect(error).toBeNull();
    expect(user).not.toBeNull();
  });

  it('error response has required/got fields for debugging', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.customer as any);
    const { error } = await withAdmin(makeReq(token));
    const body = await error!.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('required');
    expect(body).toHaveProperty('got');
    expect(body.required).toContain('ADMIN');
    expect(body.required).toContain('SUPER_ADMIN');
  });

  it('hint field present for UX guidance', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.customer as any);
    const { error } = await withAdmin(makeReq(token));
    const body = await error!.json();
    expect(body.hint).toBeTruthy();
  });
});

describe('ADMIN_ROLES constant', () => {
  it('contains ADMIN and SUPER_ADMIN only', () => {
    expect(ADMIN_ROLES).toContain('ADMIN');
    expect(ADMIN_ROLES).toContain('SUPER_ADMIN');
    expect(ADMIN_ROLES).not.toContain('CUSTOMER');
    expect(ADMIN_ROLES.length).toBe(2);
  });
});
