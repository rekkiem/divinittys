import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  isFirstOrderFreeShippingEnabled,
  isEligibleForFirstOrderFreeShipping,
} from '@/lib/shipping/first-order-free';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('isFirstOrderFreeShippingEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setting ausente → true (default)', async () => {
    vi.mocked(prisma.setting.findUnique).mockResolvedValue(null as any);
    await expect(isFirstOrderFreeShippingEnabled()).resolves.toBe(true);
  });

  it("'true' | '1' | 'yes' → activo", async () => {
    for (const value of ['true', '1', 'yes', 'TRUE', ' Yes ']) {
      vi.mocked(prisma.setting.findUnique).mockResolvedValue({ key: 'first_order_free_shipping', value } as any);
      await expect(isFirstOrderFreeShippingEnabled()).resolves.toBe(true);
    }
  });

  it("otro texto → inactivo", async () => {
    vi.mocked(prisma.setting.findUnique).mockResolvedValue({ key: 'first_order_free_shipping', value: 'false' } as any);
    await expect(isFirstOrderFreeShippingEnabled()).resolves.toBe(false);
  });

  it('error de lectura → fail-closed false', async () => {
    vi.mocked(prisma.setting.findUnique).mockRejectedValue(new Error('db down'));
    await expect(isFirstOrderFreeShippingEnabled()).resolves.toBe(false);
  });
});

describe('isEligibleForFirstOrderFreeShipping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.setting.findUnique).mockResolvedValue({ key: 'first_order_free_shipping', value: 'true' } as any);
    vi.mocked(prisma.order.count).mockResolvedValue(0);
  });

  it('setting false → no elegible', async () => {
    vi.mocked(prisma.setting.findUnique).mockResolvedValue({ key: 'first_order_free_shipping', value: 'false' } as any);
    await expect(isEligibleForFirstOrderFreeShipping({ email: 'a@b.cl' })).resolves.toBe(false);
    expect(prisma.order.count).not.toHaveBeenCalled();
  });

  it('sin userId ni email → no elegible', async () => {
    await expect(isEligibleForFirstOrderFreeShipping({})).resolves.toBe(false);
  });

  it('guest sin órdenes → elegible', async () => {
    vi.mocked(prisma.order.count).mockResolvedValue(0);
    await expect(isEligibleForFirstOrderFreeShipping({ email: 'New@Mail.CL' })).resolves.toBe(true);
    expect(prisma.order.count).toHaveBeenCalled();
    const arg = vi.mocked(prisma.order.count).mock.calls[0][0] as any;
    // email normalizado a lower en el helper
    expect(JSON.stringify(arg)).toContain('new@mail.cl');
  });

  it('guest con PAID → no elegible', async () => {
    vi.mocked(prisma.order.count).mockResolvedValue(1);
    await expect(isEligibleForFirstOrderFreeShipping({ email: 'a@b.cl' })).resolves.toBe(false);
  });

  it('mayúsculas/minúsculas no cambian el resultado', async () => {
    vi.mocked(prisma.order.count).mockResolvedValue(0);
    await isEligibleForFirstOrderFreeShipping({ email: 'FOO@BAR.CL' });
    await isEligibleForFirstOrderFreeShipping({ email: 'foo@bar.cl' });
    const a = JSON.stringify(vi.mocked(prisma.order.count).mock.calls[0][0]);
    const b = JSON.stringify(vi.mocked(prisma.order.count).mock.calls[1][0]);
    expect(a).toBe(b);
  });

  it('usuario con userId consulta por userId', async () => {
    vi.mocked(prisma.order.count).mockResolvedValue(1);
    await expect(
      isEligibleForFirstOrderFreeShipping({ userId: 'u1', email: 'other@x.cl' })
    ).resolves.toBe(false);
    const arg = vi.mocked(prisma.order.count).mock.calls[0][0] as any;
    expect(JSON.stringify(arg)).toContain('u1');
  });
});
