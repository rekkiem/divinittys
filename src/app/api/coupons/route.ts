import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { created, ok, serverError } from '@/lib/utils/api';

const schema = z.object({
  code: z.string().min(3),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value: z.coerce.number().nonnegative(),
  minOrderAmount: z.coerce.number().optional(),
  maxUses: z.coerce.number().int().optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function GET() {
  try {
    return ok(await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } }));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.parse(await req.json());
    const coupon = await prisma.coupon.create({
      data: {
        ...parsed,
        code: parsed.code.toUpperCase(),
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
      },
    });
    return created(coupon);
  } catch (error) {
    return serverError(error);
  }
}
