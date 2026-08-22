/**
 * POST|GET /api/cron/cleanup-abandoned-orders
 *
 * Protegido con header Authorization: Bearer $CRON_SECRET
 * o query ?secret=$CRON_SECRET
 *
 * Ejemplo crontab (cada 15 min):
 *   */15 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://divinittys.cl/api/cron/cleanup-abandoned-orders
 */
import { NextRequest, NextResponse } from 'next/server';
import { cancelAbandonedOrders } from '@/lib/orders/abandoned-orders';
import { ok, unauthorized, serverError } from '@/lib/utils/api';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Sin secret configurado, solo permitir en desarrollo
    return process.env.NODE_ENV !== 'production';
  }

  const header = req.headers.get('authorization') || '';
  if (header === `Bearer ${secret}`) return true;

  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') === secret) return true;

  return false;
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorized('CRON_SECRET inválido o ausente');
  }

  try {
    const { searchParams } = new URL(req.url);
    const minutes = searchParams.get('minutes');
    const limit = searchParams.get('limit');

    const result = await cancelAbandonedOrders({
      olderThanMinutes: minutes ? Number(minutes) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return ok(result);
  } catch (err) {
    return serverError(err);
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
