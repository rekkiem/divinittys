import { prisma } from '@/lib/prisma';

const ENABLED_KEY = 'first_order_free_shipping';

/**
 * Setting admin: first_order_free_shipping = 'true' | 'false'
 * Default: true (beneficio activo para clientes nuevos).
 */
export async function isFirstOrderFreeShippingEnabled(): Promise<boolean> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: ENABLED_KEY } });
    if (!row) return true;
    const v = String(row.value).trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  } catch {
    return true;
  }
}

/**
 * Elegible = sin ninguna orden con paymentStatus PAID
 * (userId y/o email de guest / cuenta).
 */
export async function isEligibleForFirstOrderFreeShipping(params: {
  userId?: string | null;
  email?: string | null;
}): Promise<boolean> {
  const enabled = await isFirstOrderFreeShippingEnabled();
  if (!enabled) return false;

  const email = params.email?.trim().toLowerCase() || null;
  if (!params.userId && !email) return false;

  const orClauses: Array<Record<string, unknown>> = [];
  if (params.userId) {
    orClauses.push({ userId: params.userId });
  }
  if (email) {
    orClauses.push({ guestEmail: { equals: email, mode: 'insensitive' } });
    orClauses.push({ user: { email: { equals: email, mode: 'insensitive' } } });
  }

  if (orClauses.length === 0) return false;

  const count = await prisma.order.count({
    where: {
      paymentStatus: 'PAID',
      OR: orClauses,
    },
  });

  return count === 0;
}
