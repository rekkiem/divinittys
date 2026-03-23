/**
 * Integration Tests: Admin Products API
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/products/route';
import { PATCH, DELETE } from '@/app/api/admin/products/[id]/route';
import { prisma } from '@/lib/prisma';
import {
  makeAdminToken, makeCustomerToken, makeToken,
  MOCK_USERS, MOCK_PRODUCT,
} from '@/tests/helpers/auth';

const VALID_PRODUCT = {
  sku: 'INT-001', name: 'Integration Test Product',
  categoryId: 'cat-test-001', basePrice: 9990,
  stock: 10, isActive: true, isFeatured: false, isOnSale: false, tags: [],
};

function makeReq(method: string, url: string, body?: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new NextRequest(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

// ── POST /api/admin/products ──────────────────────────────
describe('POST /api/admin/products', () => {
  it('returns 401 when no token', async () => {
    const req = makeReq('POST', 'http://localhost/api/admin/products', VALID_PRODUCT);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when CUSTOMER token', async () => {
    const token = await makeCustomerToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.customer as any);
    const req = makeReq('POST', 'http://localhost/api/admin/products', VALID_PRODUCT, token);
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.got).toBe('CUSTOMER');
  });

  it('returns 201 when SUPER_ADMIN creates valid product', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);
    const createdProduct = { ...MOCK_PRODUCT, id: 'new-prod-id' };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      if (typeof fn !== 'function') return Promise.all(fn);
      const tx = {
        product:   { create: vi.fn().mockResolvedValue(createdProduct) },
        inventory: { create: vi.fn().mockResolvedValue({ id: 'inv-1', stock: 10, productId: 'new-prod-id' }) },
      };
      return fn(tx);
    });
    const req = makeReq('POST', 'http://localhost/api/admin/products', VALID_PRODUCT, token);
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.product).toBeDefined();
  });

  it('returns 400 when price is missing', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const { basePrice, ...noPrize } = VALID_PRODUCT;
    const req = makeReq('POST', 'http://localhost/api/admin/products', noPrize, token);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is too short (< 2 chars)', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const req = makeReq('POST', 'http://localhost/api/admin/products', { ...VALID_PRODUCT, name: 'X' }, token);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when price is negative', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const req = makeReq('POST', 'http://localhost/api/admin/products', { ...VALID_PRODUCT, basePrice: -100 }, token);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when categoryId is missing', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const { categoryId, ...noCategory } = VALID_PRODUCT;
    const req = makeReq('POST', 'http://localhost/api/admin/products', noCategory, token);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when SKU already exists', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    vi.mocked(prisma.product.findFirst).mockResolvedValue(MOCK_PRODUCT as any);
    const req = makeReq('POST', 'http://localhost/api/admin/products', VALID_PRODUCT, token);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ya existe/i);
  });

  it('ADMIN role can also create products (not only SUPER_ADMIN)', async () => {
    const token = await makeToken('ADMIN', MOCK_USERS.admin.id);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.admin as any);
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      if (typeof fn !== 'function') return Promise.all(fn);
      const tx = {
        product:   { create: vi.fn().mockResolvedValue(MOCK_PRODUCT) },
        inventory: { create: vi.fn().mockResolvedValue({ id: 'inv-1', stock: 5, productId: MOCK_PRODUCT.id }) },
      };
      return fn(tx);
    });
    const req = makeReq('POST', 'http://localhost/api/admin/products', { ...VALID_PRODUCT, sku: 'ADM-001' }, token);
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

// ── PATCH /api/admin/products/[id] ───────────────────────
describe('PATCH /api/admin/products/[id]', () => {
  it('returns 401 with no token', async () => {
    const req = makeReq('PATCH', `http://localhost/api/admin/products/prod-1`, { isActive: false });
    const res = await PATCH(req, { params: { id: 'prod-1' } });
    expect(res.status).toBe(401);
  });

  it('returns 403 with CUSTOMER token', async () => {
    const token = await makeCustomerToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.customer as any);
    const req = makeReq('PATCH', `http://localhost/api/admin/products/prod-1`, { isActive: false }, token);
    const res = await PATCH(req, { params: { id: 'prod-1' } });
    expect(res.status).toBe(403);
  });

  it('returns 200 when admin updates product status', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const updatedProduct = { ...MOCK_PRODUCT, isActive: false };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      if (typeof fn !== 'function') return Promise.all(fn);
      const tx = {
        product:   { update: vi.fn().mockResolvedValue(updatedProduct) },
        inventory: { upsert: vi.fn().mockResolvedValue({ id: 'inv-1', stock: 10 }) },
      };
      return fn(tx);
    });
    const req = makeReq('PATCH', `http://localhost/api/admin/products/${MOCK_PRODUCT.id}`, { isActive: false }, token);
    const res = await PATCH(req, { params: { id: MOCK_PRODUCT.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.product.isActive).toBe(false);
  });

  it('returns 400 with invalid price', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const req = makeReq('PATCH', `http://localhost/api/admin/products/prod-1`, { basePrice: -50 }, token);
    const res = await PATCH(req, { params: { id: 'prod-1' } });
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/admin/products/[id] ──────────────────────
describe('DELETE /api/admin/products/[id]', () => {
  it('returns 401 with no token', async () => {
    const req = new NextRequest(`http://localhost/api/admin/products/prod-1`, { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: 'prod-1' } });
    expect(res.status).toBe(401);
  });

  it('returns 403 with CUSTOMER token', async () => {
    const token = await makeCustomerToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.customer as any);
    const req = new NextRequest(`http://localhost/api/admin/products/prod-1`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    const res = await DELETE(req, { params: { id: 'prod-1' } });
    expect(res.status).toBe(403);
  });

  it('returns 404 when product not found', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
    const req = new NextRequest(`http://localhost/api/admin/products/nonexistent`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    const res = await DELETE(req, { params: { id: 'nonexistent' } });
    expect(res.status).toBe(404);
  });

  it('returns 200 when admin deletes product', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    vi.mocked(prisma.product.findUnique).mockResolvedValue(MOCK_PRODUCT as any);
    vi.mocked(prisma.product.delete).mockResolvedValue(MOCK_PRODUCT as any);
    const req = new NextRequest(`http://localhost/api/admin/products/${MOCK_PRODUCT.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    const res = await DELETE(req, { params: { id: MOCK_PRODUCT.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
  });
});
