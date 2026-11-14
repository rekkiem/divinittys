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

/**
 * Estos tests fijan la REGLA de negocio (qué órdenes consumen el beneficio) comparando el
 * `where` exacto que se envía a Prisma. `count` está mockeado, así que lo que se valida
 * aquí es la consulta, no el motor de la base: si alguien cambia la regla, esto falla.
 */
describe('regla de consumo del beneficio (where de order.count)', () => {
  const CONSUMES_BENEFIT = {
    OR: [
      { paymentStatus: 'PAID' },
      {
        firstOrderFreeShipping: true,
        status: { not: 'CANCELLED' },
        paymentStatus: { in: ['PENDING', 'PROCESSING'] },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.setting.findUnique).mockResolvedValue({ key: 'first_order_free_shipping', value: 'true' } as any);
    vi.mocked(prisma.order.count).mockResolvedValue(0);
  });

  it('consume el beneficio: orden PAID, o pendiente/en proceso con el flag y no cancelada', async () => {
    await isEligibleForFirstOrderFreeShipping({ userId: 'u1', email: 'A@B.cl' });
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: 'u1' }, { guestEmail: 'a@b.cl' }, { user: { email: 'a@b.cl' } }],
        AND: [CONSUMES_BENEFIT],
      },
    });
  });

  it('guest: identifica solo por email (guestEmail y email de cuenta), sin cláusula userId', async () => {
    await isEligibleForFirstOrderFreeShipping({ email: 'guest@x.cl' });
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: {
        OR: [{ guestEmail: 'guest@x.cl' }, { user: { email: 'guest@x.cl' } }],
        AND: [CONSUMES_BENEFIT],
      },
    });
  });

  it('solo userId (sin email): identifica solo por userId', async () => {
    await isEligibleForFirstOrderFreeShipping({ userId: 'u9' });
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: { OR: [{ userId: 'u9' }], AND: [CONSUMES_BENEFIT] },
    });
  });

  it('el email se normaliza: espacios y mayúsculas', async () => {
    await isEligibleForFirstOrderFreeShipping({ email: '  MiXeD@Mail.CL ' });
    const where = vi.mocked(prisma.order.count).mock.calls[0][0]!.where as any;
    expect(where.OR).toContainEqual({ guestEmail: 'mixed@mail.cl' });
  });

  it('con `db` (cliente transaccional) NO toca el prisma global', async () => {
    const tx = {
      setting: { findUnique: vi.fn().mockResolvedValue(null) },
      order: { count: vi.fn().mockResolvedValue(0) },
    };
    await expect(isEligibleForFirstOrderFreeShipping({ email: 'a@b.cl', db: tx as any })).resolves.toBe(true);
    expect(tx.setting.findUnique).toHaveBeenCalledTimes(1);
    expect(tx.order.count).toHaveBeenCalledTimes(1);
    expect(prisma.setting.findUnique).not.toHaveBeenCalled();
    expect(prisma.order.count).not.toHaveBeenCalled();
  });

  it('skipEnabledCheck: no lee el setting', async () => {
    await expect(isEligibleForFirstOrderFreeShipping({ email: 'a@b.cl', skipEnabledCheck: true })).resolves.toBe(true);
    expect(prisma.setting.findUnique).not.toHaveBeenCalled();
    expect(prisma.order.count).toHaveBeenCalledTimes(1);
  });

  it('si falla la lectura del setting → fail-closed: no elegible y sin consultar órdenes', async () => {
    vi.mocked(prisma.setting.findUnique).mockRejectedValue(new Error('db down'));
    await expect(isEligibleForFirstOrderFreeShipping({ email: 'a@b.cl' })).resolves.toBe(false);
    expect(prisma.order.count).not.toHaveBeenCalled();
  });
});
