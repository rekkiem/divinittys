import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const ENABLED_KEY = 'first_order_free_shipping';

type DbClient = typeof prisma;

/**
 * Setting admin: first_order_free_shipping = 'true' | 'false'
 * Default when absent: true. On read error: fail-closed (false).
 */
export async function isFirstOrderFreeShippingEnabled(
  db: DbClient = prisma
): Promise<boolean> {
  try {
    const row = await db.setting.findUnique({ where: { key: ENABLED_KEY } });
    if (!row) return true;
    const v = String(row.value).trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  } catch (error) {
    logger.error('first_order_free_shipping.enabled_check_failed', { error });
    return false;
  }
}

/**
 * Elegible si el setting está activo y no existe orden que consuma el beneficio:
 * - paymentStatus = PAID, o
 * - firstOrderFreeShipping = true y status != CANCELLED y paymentStatus IN (PENDING, PROCESSING)
 *
 * Acepta `db` opcional (cliente de transacción Prisma).
 */
export async function isEligibleForFirstOrderFreeShipping(params: {
  userId?: string | null;
  email?: string | null;
  db?: DbClient;
  /** Si true, no consulta el setting (ya validado fuera). */
  skipEnabledCheck?: boolean;
}): Promise<boolean> {
  const db = params.db ?? prisma;

  if (!params.skipEnabledCheck) {
    const enabled = await isFirstOrderFreeShippingEnabled(db);
    if (!enabled) return false;
  }

  const email = params.email?.trim().toLowerCase() || null;
  if (!params.userId && !email) return false;

  const identityOr: Array<Record<string, unknown>> = [];
  if (params.userId) {
    identityOr.push({ userId: params.userId });
  }
  if (email) {
    // guestEmail se persiste normalizado (lower+trim); igualdad exacta
    identityOr.push({ guestEmail: email });
    // users.email se guarda con sanitizeEmail (lowercase) en registro
    identityOr.push({ user: { email } });
  }

  if (identityOr.length === 0) return false;

  const count = await db.order.count({
    where: {
      OR: identityOr,
      AND: [
        {
          OR: [
            { paymentStatus: 'PAID' },
            {
              firstOrderFreeShipping: true,
              status: { not: 'CANCELLED' },
              paymentStatus: { in: ['PENDING', 'PROCESSING'] },
            },
          ],
        },
      ],
    },
  });

  return count === 0;
}
