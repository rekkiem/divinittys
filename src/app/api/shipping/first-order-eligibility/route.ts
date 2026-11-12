import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { ok, badRequest, serverError } from '@/lib/utils/api';
import { isEligibleForFirstOrderFreeShipping } from '@/lib/shipping/first-order-free';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().email().optional(),
});

/**
 * GET /api/shipping/first-order-eligibility?email=
 * POST { email? }
 *
 * Resuelve user autenticado y/o email (guest).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const emailParam = req.nextUrl.searchParams.get('email') || undefined;
    const email = emailParam || user?.email || undefined;

    if (!user?.id && !email) {
      return ok({ eligible: false, reason: 'missing_identity' });
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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const body = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return badRequest('Email inválido');

    const email = body.data.email || user?.email || undefined;
    if (!user?.id && !email) {
      return ok({ eligible: false, reason: 'missing_identity' });
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
