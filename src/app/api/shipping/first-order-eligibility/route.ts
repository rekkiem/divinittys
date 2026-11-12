import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { ok, badRequest, serverError } from '@/lib/utils/api';
import { rateLimit } from '@/lib/security/rate-limit';
import { sanitizeEmail } from '@/lib/security/sanitize';
import { isEligibleForFirstOrderFreeShipping } from '@/lib/shipping/first-order-free';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().email().optional(),
});

/** GET eliminado (B3): email en query quedaba en logs. */
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

/**
 * POST { email? }
 * Resuelve user autenticado y/o email (guest).
 * Rate limit: 10 req / 15 min por IP.
 */
export async function POST(req: NextRequest) {
  try {
    const limit = await rateLimit(req, {
      key: 'first-order-eligibility',
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas consultas. Intenta más tarde.' },
        { status: 429 }
      );
    }

    const user = await getAuthUser(req);
    const body = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return badRequest('Email inválido');

    const rawEmail = body.data.email || user?.email || undefined;
    const email = rawEmail ? sanitizeEmail(rawEmail) : undefined;

    if (!user?.id && !email) {
      return ok({ eligible: false });
    }

    const eligible = await isEligibleForFirstOrderFreeShipping({
      userId: user?.id,
      email,
    });

    return ok({ eligible });
  } catch (e) {
    return serverError(e);
  }
}
