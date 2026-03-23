import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/admin/orders/[id]/route';
import { prisma } from '@/lib/prisma';
import { makeAdminToken, makeCustomerToken, MOCK_USERS } from '@/tests/helpers/auth';

const MOCK_ORDER = { id: 'order-1', orderNumber: 'DIV-001', status: 'PENDING', total: 29990 };

function makePatchReq(id: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new NextRequest(`http://localhost/api/admin/orders/${id}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
}

describe('PATCH /api/admin/orders/[id]', () => {
  it('returns 401 without token', async () => {
    expect((await PATCH(makePatchReq('order-1', { status: 'CONFIRMED' }), { params: { id: 'order-1' } })).status).toBe(401);
  });

  it('returns 403 for CUSTOMER', async () => {
    const token = await makeCustomerToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.customer as any);
    expect((await PATCH(makePatchReq('order-1', { status: 'CONFIRMED' }, token), { params: { id: 'order-1' } })).status).toBe(403);
  });

  it('returns 200 when admin updates status', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    vi.mocked(prisma.order.update).mockResolvedValue({ ...MOCK_ORDER, status: 'CONFIRMED' } as any);
    const res = await PATCH(makePatchReq(MOCK_ORDER.id, { status: 'CONFIRMED' }, token), { params: { id: MOCK_ORDER.id } });
    expect(res.status).toBe(200);
    expect((await res.json()).data.order.status).toBe('CONFIRMED');
  });

  it('returns 400 for invalid status', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    expect((await PATCH(makePatchReq('order-1', { status: 'FAKE' }, token), { params: { id: 'order-1' } })).status).toBe(400);
  });

  it('transitions through all valid statuses', async () => {
    const valid = ['PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED'];
    for (const status of valid) {
      const token = await makeAdminToken();
      vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
      vi.mocked(prisma.order.update).mockResolvedValue({ ...MOCK_ORDER, status } as any);
      const res = await PATCH(makePatchReq('order-1', { status }, token), { params: { id: 'order-1' } });
      expect(res.status).toBe(200);
    }
  });
});
