/**
 * Integration Tests: Admin Auth Middleware (withAdmin)
 * Tests the centralized authorization layer in isolation
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { withAdmin, requireAdmin, ADMIN_ROLES } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { makeAdminToken, makeCustomerToken, makeToken, MOCK_USERS } from '@/tests/helpers/auth';
import { signAccessToken } from '@/lib/auth';

function makeReq(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new NextRequest('http://localhost/api/admin/products', { method: 'POST', headers });
}

describe('withAdmin middleware', () => {
  it('returns error when no token', async () => {
    const req = makeReq();
    const { user, error } = await withAdmin(req);
    expect(user).toBeNull();
    expect(error).toBeDefined();
    expect(error!.status).toBe(401);
  });

  it('returns error when token is garbage', async () => {
    const req = makeReq('not-a-valid-token');
    const { user, error } = await withAdmin(req);
    expect(user).toBeNull();
    expect(error).toBeDefined();
    expect(error!.status).toBe(401);
  });

  it('returns 403 when JWT role is CUSTOMER', async () => {
    const token = await makeCustomerToken();
    const req = makeReq(token);
    // No DB call needed — JWT check fails first
    const { user, error } = await withAdmin(req);
    expect(user).toBeNull();
    expect(error!.status).toBe(403);
    const body = await error!.json();
    expect(body.got).toBe('CUSTOMER');
  });

  it('returns 403 when DB user not found (inactive)', async () => {
    const token = await makeAdminToken('inactive-user-id');
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null); // not found
    const req = makeReq(token);
    const { user, error } = await withAdmin(req);
    expect(user).toBeNull();
    expect(error!.status).toBe(403);
  });

  it('returns 403 when DB role differs from JWT role', async () => {
    // Edge case: JWT says SUPER_ADMIN but DB has CUSTOMER (role was demoted)
    const token = await makeToken('SUPER_ADMIN', 'demoted-user');
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(MOCK_USERS.customer as any);
    const req = makeReq(token);
    const { user, error } = await withAdmin(req);
    expect(user).toBeNull();
    expect(error!.status).toBe(403);
  });

  it('returns user when SUPER_ADMIN token and DB match', async () => {
    const token = await makeAdminToken(MOCK_USERS.superAdmin.id);
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(MOCK_USERS.superAdmin as any);
    const req = makeReq(token);
    const { user, error } = await withAdmin(req);
    expect(error).toBeNull();
    expect(user).not.toBeNull();
    expect(user!.role).toBe('SUPER_ADMIN');
    expect(user!.email).toBe(MOCK_USERS.superAdmin.email);
  });

  it('returns user when ADMIN token and DB match', async () => {
    const token = await makeToken('ADMIN', MOCK_USERS.admin.id);
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(MOCK_USERS.admin as any);
    const req = makeReq(token);
    const { user, error } = await withAdmin(req);
    expect(error).toBeNull();
    expect(user!.role).toBe('ADMIN');
  });

  it('reads token from Authorization header (not just cookie)', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(MOCK_USERS.superAdmin as any);
    // Explicitly use header, NOT cookie
    const req = new NextRequest('http://localhost/api/admin/products', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const { user, error } = await withAdmin(req);
    expect(error).toBeNull();
    expect(user).not.toBeNull();
  });

  it('reads token from cookie as fallback', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(MOCK_USERS.superAdmin as any);
    const req = new NextRequest('http://localhost/api/admin/products', {
      method: 'POST',
      headers: { 'cookie': `access_token=${token}` },
    });
    const { user, error } = await withAdmin(req);
    expect(error).toBeNull();
    expect(user).not.toBeNull();
  });

  it('error response has descriptive JSON body', async () => {
    const token = await makeCustomerToken();
    const req = makeReq(token);
    const { error } = await withAdmin(req);
    const body = await error!.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('required');
    expect(body).toHaveProperty('got');
    expect(body.required).toEqual(expect.arrayContaining(['ADMIN', 'SUPER_ADMIN']));
  });
});

describe('ADMIN_ROLES constant', () => {
  it('is readonly and contains expected roles', () => {
    expect(ADMIN_ROLES).toContain('ADMIN');
    expect(ADMIN_ROLES).toContain('SUPER_ADMIN');
    expect(ADMIN_ROLES).not.toContain('CUSTOMER');
    expect(ADMIN_ROLES.length).toBe(2);
  });
});
