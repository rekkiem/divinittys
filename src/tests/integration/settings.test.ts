/**
 * Integration Tests: Admin Settings API
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/admin/settings/route';
import { prisma } from '@/lib/prisma';
import { makeAdminToken, makeCustomerToken, MOCK_USERS } from '@/tests/helpers/auth';

const MOCK_SETTINGS = [
  { id: '1', key: 'store_name',  value: 'DIVINITTYS', type: 'string' },
  { id: '2', key: 'store_email', value: 'hola@test.cl', type: 'string' },
];

function makeReq(method: string, token?: string, body?: object) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new NextRequest('http://localhost/api/admin/settings', {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/admin/settings', () => {
  it('401 without token', async () => {
    expect((await GET(makeReq('GET'))).status).toBe(401);
  });

  it('403 for CUSTOMER', async () => {
    const token = await makeCustomerToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.customer as any);
    expect((await GET(makeReq('GET', token))).status).toBe(403);
  });

  it('200 returns settings as key-value object', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    vi.mocked(prisma.setting.findMany).mockResolvedValue(MOCK_SETTINGS as any);
    const res = await GET(makeReq('GET', token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.settings).toEqual({ store_name: 'DIVINITTYS', store_email: 'hola@test.cl' });
  });
});

describe('PUT /api/admin/settings', () => {
  it('401 without token', async () => {
    expect((await PUT(makeReq('PUT', undefined, { store_name: 'X' }))).status).toBe(401);
  });

  it('200 saves all keys and returns count', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    vi.mocked(prisma.setting.upsert).mockResolvedValue(MOCK_SETTINGS[0] as any);
    const res = await PUT(makeReq('PUT', token, { store_name: 'Nueva', store_email: 'x@x.cl' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.saved).toBe(2);
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(2);
  });

  it('400 when body is array instead of object', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const req = new NextRequest('http://localhost/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(['invalid']),
    });
    expect((await PUT(req)).status).toBe(400);
  });
});
