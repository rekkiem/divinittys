/**
 * Integration Tests: POST /api/orders — envío gratis en primera compra
 *
 * Prisma está mockeado (src/tests/setup.ts): estos tests validan la LÓGICA de la ruta
 * (decisión de envío gratis, flag, 409, orden del lock, opciones de la transacción).
 * La serialización real entre transacciones concurrentes depende de Postgres
 * (pg_advisory_xact_lock) y no se puede probar con mocks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/orders/route';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { CHILE_REGION_NAMES, communesForRegion } from '@/lib/chile/geo';

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, getAuthUser: vi.fn() };
});

vi.mock('@/lib/shipping/bluexpress', () => ({
  quoteBluexpress: vi.fn().mockResolvedValue([{ price: 4500, serviceName: 'Express', serviceCode: 'EXP' }]),
  calculatePackageFromOrder: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/shipping/free-shipping', () => ({
  getFreeShippingThreshold: vi.fn().mockResolvedValue(29990),
  PUBLIC_SETTING_KEYS: [],
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const REGION = CHILE_REGION_NAMES[0];
const COMMUNE = communesForRegion(REGION)[0];

function product(basePrice: number) {
  return {
    id: 'prod-1', name: 'Shampoo Pro', sku: 'SKU-1', basePrice, isActive: true,
    inventory: { stock: 10, trackStock: true }, variants: [], images: [{ url: '/img.jpg' }],
  };
}

function orderRequest(opts: { email?: string; shippingAmount?: number; couponCode?: string } = {}) {
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingData: {
        firstName: 'Ana', lastName: 'Pérez', street: 'Av. Siempre Viva', number: '742',
        commune: COMMUNE, city: 'Santiago', region: REGION, phone: '+56912345678',
        email: opts.email ?? 'New@Mail.CL',
      },
      shippingAmount: opts.shippingAmount,
      couponCode: opts.couponCode,
    }),
  });
}

/**
 * Cliente transaccional falso. `count` simula la regla "pendiente con flag consume el beneficio"
 * sobre las órdenes que este mismo fake va guardando, de modo que se puedan encadenar pedidos.
 * Nota: no es un motor de consultas; solo entiende la cláusula guestEmail del helper.
 */
function makeTx(opts: { setting?: string | null; forceCount?: number } = {}) {
  const store: any[] = [];
  const tx = {
    store,
    $executeRaw: vi.fn().mockResolvedValue(0),
    setting: {
      findUnique: vi.fn().mockResolvedValue(
        opts.setting === null ? null : { key: 'first_order_free_shipping', value: opts.setting ?? 'true' }
      ),
    },
    order: {
      count: vi.fn(async ({ where }: any) => {
        if (typeof opts.forceCount === 'number') return opts.forceCount;
        const emails = where.OR.map((c: any) => c.guestEmail).filter(Boolean);
        return store.filter(
          (o) => emails.includes(o.guestEmail) && o.firstOrderFreeShipping && o.status !== 'CANCELLED'
        ).length;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `order-${store.length + 1}`, status: 'PENDING', ...data };
        store.push(row);
        return row;
      }),
    },
    address: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'addr-1' }),
      update: vi.fn(),
    },
    inventory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), upsert: vi.fn() },
    productVariant: { updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    coupon: { update: vi.fn() },
  };
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx));
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthUser).mockResolvedValue(null as any);
  vi.mocked(prisma.product.findMany).mockResolvedValue([product(10000)] as any);
  (prisma as any).coupon = { findFirst: vi.fn().mockResolvedValue(null) };
});

describe('POST /api/orders — primera compra con envío gratis', () => {
  it('guest elegible: envío $0, flag true, email normalizado y source=first_order', async () => {
    const tx = makeTx();
    const res = await POST(orderRequest({ shippingAmount: 0, email: 'New@Mail.CL' }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.data.firstOrderFreeShipping).toBe(true);
    expect(body.data.shippingSource).toBe('first_order');

    const data = tx.order.create.mock.calls[0][0].data;
    expect(data.firstOrderFreeShipping).toBe(true);
    expect(data.shippingAmount).toBe(0);
    expect(data.total).toBe(10000);
    expect(data.guestEmail).toBe('new@mail.cl');
    expect(data.shippingData.email).toBe('new@mail.cl');
    expect(data.notes).toContain('shipping_source=first_order');
  });

  it('el lock se toma ANTES de evaluar la elegibilidad y de crear la orden', async () => {
    const tx = makeTx();
    await POST(orderRequest({ shippingAmount: 0 }));

    const lock = tx.$executeRaw.mock.invocationCallOrder[0];
    expect(lock).toBeLessThan(tx.order.count.mock.invocationCallOrder[0]);
    expect(lock).toBeLessThan(tx.order.create.mock.invocationCallOrder[0]);
  });

  it('la elegibilidad se evalúa con el cliente transaccional, no con el global', async () => {
    const tx = makeTx();
    await POST(orderRequest({ shippingAmount: 0 }));

    expect(tx.order.count).toHaveBeenCalledTimes(1);
    expect(prisma.order.count).not.toHaveBeenCalled();
    expect(prisma.setting.findUnique).not.toHaveBeenCalled();
  });

  it('guest: un lock (email). Usuario registrado: dos locks (email y userId)', async () => {
    const guestTx = makeTx();
    await POST(orderRequest({ shippingAmount: 0 }));
    expect(guestTx.$executeRaw).toHaveBeenCalledTimes(1);

    vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'u1@x.cl' } as any);
    const userTx = makeTx();
    const res = await POST(orderRequest({ shippingAmount: 0, email: 'u1@x.cl' }));
    expect(res.status).toBe(201);
    expect(userTx.$executeRaw).toHaveBeenCalledTimes(2);

    const where = userTx.order.count.mock.calls[0][0].where;
    expect(where.OR).toContainEqual({ userId: 'u1' });
    const data = userTx.order.create.mock.calls[0][0].data;
    expect(data.userId).toBe('u1');
    expect(data.guestEmail).toBeUndefined();
  });

  it('la transacción lleva timeout 20 s (la cotización de Blue Express corre dentro)', async () => {
    makeTx();
    await POST(orderRequest({ shippingAmount: 0 }));
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: 20000 })
    );
  });
});

describe('POST /api/orders — el beneficio no se usa dos veces', () => {
  it('ya consumido y el cliente pidió envío $0 → 409 y no se crea la orden', async () => {
    const tx = makeTx({ forceCount: 1 });
    const res = await POST(orderRequest({ shippingAmount: 0 }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/primera compra/i);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('ya consumido y el cliente acepta pagar envío → 201 con envío cobrado y sin flag', async () => {
    const tx = makeTx({ forceCount: 1 });
    const res = await POST(orderRequest({ shippingAmount: 4500 }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.data.firstOrderFreeShipping).toBe(false);
    const data = tx.order.create.mock.calls[0][0].data;
    expect(data.shippingAmount).toBe(4500);
    expect(data.firstOrderFreeShipping).toBe(false);
    expect(data.total).toBe(14500);
  });

  it('secuencia con el mismo email: 1ª gratis, 2ª (pendiente sin pagar) → 409, 3ª pagando envío → 201', async () => {
    const tx = makeTx();

    const first = await POST(orderRequest({ shippingAmount: 0, email: 'dup@mail.cl' }));
    expect(first.status).toBe(201);

    // Mismo email con otra capitalización: debe contar como la misma identidad
    const second = await POST(orderRequest({ shippingAmount: 0, email: 'DUP@Mail.cl' }));
    expect(second.status).toBe(409);

    const third = await POST(orderRequest({ shippingAmount: 4500, email: 'dup@mail.cl' }));
    expect(third.status).toBe(201);

    expect(tx.store).toHaveLength(2);
    expect(tx.store[0].firstOrderFreeShipping).toBe(true);
    expect(tx.store[1].firstOrderFreeShipping).toBe(false);
    expect(tx.store[1].shippingAmount).toBe(4500);
  });

  it('una orden CANCELLED libera el beneficio', async () => {
    const tx = makeTx();
    await POST(orderRequest({ shippingAmount: 0, email: 'cancel@mail.cl' }));
    tx.store[0].status = 'CANCELLED';

    const res = await POST(orderRequest({ shippingAmount: 0, email: 'cancel@mail.cl' }));
    expect(res.status).toBe(201);
    expect(tx.store[1].firstOrderFreeShipping).toBe(true);
  });
});

describe('POST /api/orders — otras fuentes de envío gratis no consumen el beneficio', () => {
  it('subtotal sobre el umbral → source=free_threshold y flag false', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([product(35000)] as any);
    const tx = makeTx();
    const res = await POST(orderRequest({ shippingAmount: 0 }));
    expect(res.status).toBe(201);

    const data = tx.order.create.mock.calls[0][0].data;
    expect(data.shippingAmount).toBe(0);
    expect(data.firstOrderFreeShipping).toBe(false);
    expect(data.notes).toContain('shipping_source=free_threshold');
    expect((await res.json()).data.firstOrderFreeShipping).toBe(false);
  });

  it('cupón FREE_SHIPPING → source=free_coupon y flag false', async () => {
    (prisma as any).coupon.findFirst.mockResolvedValue({
      code: 'ENVIOFREE', type: 'FREE_SHIPPING', value: 0, minOrderAmount: null, maxUses: null, usedCount: 0,
    });
    const tx = makeTx();
    const res = await POST(orderRequest({ shippingAmount: 0, couponCode: 'envioFree' }));
    expect(res.status).toBe(201);

    const data = tx.order.create.mock.calls[0][0].data;
    expect(data.firstOrderFreeShipping).toBe(false);
    expect(data.notes).toContain('shipping_source=free_coupon');
  });
});

describe('POST /api/orders — beneficio desactivado desde admin', () => {
  it("setting 'false': se cobra el envío, no se consulta el historial y no hay flag", async () => {
    const tx = makeTx({ setting: 'false' });
    const res = await POST(orderRequest({ shippingAmount: 4500 }));
    expect(res.status).toBe(201);

    expect(tx.order.count).not.toHaveBeenCalled();
    const data = tx.order.create.mock.calls[0][0].data;
    expect(data.shippingAmount).toBe(4500);
    expect(data.firstOrderFreeShipping).toBe(false);
  });

  it("setting 'false' y un cliente desactualizado que pide $0 → 409 (no se regala el envío)", async () => {
    const tx = makeTx({ setting: 'false' });
    const res = await POST(orderRequest({ shippingAmount: 0 }));
    expect(res.status).toBe(409);
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});
