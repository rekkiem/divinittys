/**
 * Integration Tests: /api/shipping/first-order-eligibility
 *
 * Endpoint público → debe ser solo POST, con rate limit y sin filtrar más que { eligible }.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/shipping/first-order-eligibility/route';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { rateLimit } from '@/lib/security/rate-limit';

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, getAuthUser: vi.fn() };
});

// setup.ts fija REDIS_URL; se mockea para no depender de Redis ni del Map en memoria.
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: vi.fn(),
  getRequestIp: vi.fn().mockReturnValue('1.2.3.4'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function post(body?: unknown) {
  return new NextRequest('http://localhost/api/shipping/first-order-eligibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 1000 });
  vi.mocked(getAuthUser).mockResolvedValue(null as any);
  vi.mocked(prisma.setting.findUnique).mockResolvedValue({ key: 'first_order_free_shipping', value: 'true' } as any);
  vi.mocked(prisma.order.count).mockResolvedValue(0);
});

describe('/api/shipping/first-order-eligibility', () => {
  it('GET → 405 con Allow: POST (el email ya no viaja en la query string)', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
    expect(prisma.order.count).not.toHaveBeenCalled();
  });

  it('POST con email nuevo → 200 { eligible: true } y nada más en la respuesta', async () => {
    const res = await POST(post({ email: 'nuevo@mail.cl' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ eligible: true });
  });

  it('POST con email que ya compró → { eligible: false }, sin campo `reason`', async () => {
    vi.mocked(prisma.order.count).mockResolvedValue(1);
    const res = await POST(post({ email: 'cliente@mail.cl' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ eligible: false });
  });

  it('rate limit excedido → 429 y no se consulta la base', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });
    const res = await POST(post({ email: 'x@mail.cl' }));
    expect(res.status).toBe(429);
    expect(prisma.order.count).not.toHaveBeenCalled();
  });

  it('el límite configurado es 10 requests / 15 min', async () => {
    await POST(post({ email: 'x@mail.cl' }));
    expect(rateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ key: 'first-order-eligibility', limit: 10, windowMs: 15 * 60 * 1000 })
    );
  });

  it('email inválido → 400', async () => {
    const res = await POST(post({ email: 'no-es-un-email' }));
    expect(res.status).toBe(400);
    expect(prisma.order.count).not.toHaveBeenCalled();
  });

  it('sin email y sin sesión → { eligible: false } sin consultar órdenes', async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ eligible: false });
    expect(prisma.order.count).not.toHaveBeenCalled();
  });

  it('autenticado sin email en el body → usa userId y el email de la sesión', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'Yo@Mail.cl' } as any);
    const res = await POST(post({}));
    expect(res.status).toBe(200);

    const where = vi.mocked(prisma.order.count).mock.calls[0][0]!.where as any;
    expect(where.OR).toContainEqual({ userId: 'u1' });
    expect(where.OR).toContainEqual({ guestEmail: 'yo@mail.cl' });
  });
});
