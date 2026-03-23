import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/categories/route';
import { PATCH } from '@/app/api/admin/categories/[id]/route';
import { prisma } from '@/lib/prisma';
import { makeAdminToken, makeCustomerToken, MOCK_USERS, MOCK_CATEGORY } from '@/tests/helpers/auth';

function makeReq(method: string, url: string, body?: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new NextRequest(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

describe('POST /api/admin/categories', () => {
  it('returns 401 without token', async () => {
    const req = makeReq('POST', 'http://localhost/api/admin/categories', { name: 'Test', slug: 'test' });
    expect((await POST(req)).status).toBe(401);
  });

  it('returns 403 for CUSTOMER', async () => {
    const token = await makeCustomerToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.customer as any);
    const req = makeReq('POST', 'http://localhost/api/admin/categories', { name: 'Test', slug: 'test' }, token);
    expect((await POST(req)).status).toBe(403);
  });

  it('returns 201 when admin creates category', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    vi.mocked(prisma.category.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.category.create).mockResolvedValue(MOCK_CATEGORY as any);
    const req = makeReq('POST', 'http://localhost/api/admin/categories', { name: 'Nueva Cat', slug: 'nueva-cat' }, token);
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect((await res.json()).data.category.name).toBe('Cuidado Capilar');
  });

  it('returns 400 when category already exists', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    vi.mocked(prisma.category.findFirst).mockResolvedValue(MOCK_CATEGORY as any);
    const req = makeReq('POST', 'http://localhost/api/admin/categories', { name: 'Dup', slug: 'dup' }, token);
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ya existe/i);
  });

  it('returns 400 when name empty', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const req = makeReq('POST', 'http://localhost/api/admin/categories', { name: '', slug: 'test' }, token);
    expect((await POST(req)).status).toBe(400);
  });
});

describe('PATCH /api/admin/categories/[id]', () => {
  it('returns 200 when admin toggles isActive', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    vi.mocked(prisma.category.update).mockResolvedValue({ ...MOCK_CATEGORY, isActive: false } as any);
    const req = makeReq('PATCH', `http://localhost/api/admin/categories/cat-1`, { isActive: false }, token);
    const res = await PATCH(req, { params: { id: 'cat-1' } });
    expect(res.status).toBe(200);
    expect((await res.json()).data.category.isActive).toBe(false);
  });

  it('returns 400 with invalid data type', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const req = makeReq('PATCH', `http://localhost/api/admin/categories/cat-1`, { isActive: 'yes_string' }, token);
    expect((await PATCH(req, { params: { id: 'cat-1' } })).status).toBe(400);
  });
});
