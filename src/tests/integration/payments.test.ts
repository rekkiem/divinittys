/**
 * Integration Tests: Payments API
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/payments/route';
import { prisma } from '@/lib/prisma';
import { makeAdminToken, MOCK_USERS } from '@/tests/helpers/auth';

vi.mock('@/lib/payments/webpay', () => ({
  createWebpayTransaction: vi.fn().mockResolvedValue({
    token: 'tbk-token-123',
    url:   'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
  }),
  commitWebpayTransaction: vi.fn().mockResolvedValue({
    response_code: 0, status: 'AUTHORIZED',
    authorization_code: 'AUTH123', installments_number: 1, payment_type_code: 'VD',
  }),
}));

vi.mock('@/lib/payments/mercadopago', () => ({
  createMPPreference: vi.fn().mockResolvedValue({
    id: 'MP-PREF-123',
    init_point: 'https://sandbox.mercadopago.cl/checkout?pref_id=MP-PREF-123',
    sandbox_init_point: 'https://sandbox.mercadopago.cl/checkout?pref_id=MP-PREF-123',
  }),
}));

const ORDER = {
  id: 'order-001', orderNumber: 'DIV-001', total: 29990,
  paymentStatus: 'PENDING', payment: null,
  items: [{ productId: 'p1', name: 'Test', quantity: 1, price: 29990, product: { images: [] } }],
};
const PAY = {
  id: 'pay-001', orderId: 'order-001', token: 'tbk-token-123',
  status: 'PROCESSING', provider: 'WEBPAY', order: ORDER,
};

function req(action: string, body: object) {
  return new NextRequest(`http://localhost/api/payments?action=${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── webpay-init ───────────────────────────────────────────────────
describe('webpay-init', () => {
  it('404 when order missing', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    expect((await POST(req('webpay-init', { orderId: 'x' }))).status).toBe(404);
  });

  it('400 when order already paid', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      { ...ORDER, payment: { status: 'PAID' } } as any
    );
    const res = await POST(req('webpay-init', { orderId: ORDER.id }));
    expect(res.status).toBe(400);
  });

  it('200 returns token + url', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(ORDER as any);
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.payment.create).mockResolvedValue(PAY as any);
    vi.mocked(prisma.payment.update).mockResolvedValue({ ...PAY, token: 'tbk-token-123' } as any);
    const res = await POST(req('webpay-init', { orderId: ORDER.id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.token).toBe('tbk-token-123');
    expect(body.data.url).toContain('transbank');
  });

  it('400 with missing orderId', async () => {
    expect((await POST(req('webpay-init', {}))).status).toBe(400);
  });
});

// ── webpay-commit ─────────────────────────────────────────────────
describe('webpay-commit', () => {
  it('404 when token not found', async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);
    expect((await POST(req('webpay-commit', { token_ws: 'bad' }))).status).toBe(404);
  });

  it('success:true when approved', async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(PAY as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      if (typeof fn !== 'function') return Promise.all(fn);
      const tx = {
        payment:   {
          findUnique: vi.fn().mockResolvedValue({ id: PAY.id, status: 'PROCESSING' }),
          update: vi.fn().mockResolvedValue({}),
        },
        order:     { update: vi.fn().mockResolvedValue({}) },
        orderItem: { findMany: vi.fn().mockResolvedValue([]) },
        inventory: { updateMany: vi.fn().mockResolvedValue({}) },
        productVariant: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      };
      return fn(tx);
    });
    const res = await POST(req('webpay-commit', { token_ws: 'tbk-token-123' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.success).toBe(true);
  });

  it('success:false when rejected', async () => {
    const { commitWebpayTransaction } = await import('@/lib/payments/webpay');
    vi.mocked(commitWebpayTransaction).mockResolvedValueOnce({
      response_code: -1, status: 'FAILED',
    } as any);
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(PAY as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      if (typeof fn !== 'function') return Promise.all(fn);
      const tx = {
        payment:   {
          findUnique: vi.fn().mockResolvedValue({ id: PAY.id, status: 'PROCESSING' }),
          update: vi.fn().mockResolvedValue({}),
        },
        order:     { update: vi.fn().mockResolvedValue({}) },
        orderItem: { findMany: vi.fn().mockResolvedValue([]) },
        inventory: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        productVariant: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      };
      return fn(tx);
    });
    const res = await POST(req('webpay-commit', { token_ws: 'tbk-token-123' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.success).toBe(false);
  });
});

// ── mp-preference ─────────────────────────────────────────────────
describe('mp-preference', () => {
  it('200 returns preferenceId + init_point', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ ...ORDER, payment: null } as any);
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.payment.create).mockResolvedValue({ ...PAY, provider: 'MERCADOPAGO' } as any);
    vi.mocked(prisma.payment.update).mockResolvedValue({ ...PAY, provider: 'MERCADOPAGO' } as any);
    const res = await POST(req('mp-preference', { orderId: ORDER.id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.preferenceId).toBe('MP-PREF-123');
    expect(body.data.init_point).toBeTruthy();
  });
});

// ── auto-detect ───────────────────────────────────────────────────
describe('auto-detect action', () => {
  it('detects webpay from provider=WEBPAY in body', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(ORDER as any);
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.payment.create).mockResolvedValue(PAY as any);
    vi.mocked(prisma.payment.update).mockResolvedValue(PAY as any);
    const noAction = new NextRequest('http://localhost/api/payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: ORDER.id, provider: 'WEBPAY' }),
    });
    const res = await POST(noAction);
    expect(res.status).toBe(200);
    expect((await res.json()).data.token).toBeDefined();
  });
});

// ── invalid action ────────────────────────────────────────────────
describe('invalid action', () => {
  it('400 for unknown action', async () => {
    expect((await POST(req('noop', { orderId: 'x' }))).status).toBe(400);
  });
});
