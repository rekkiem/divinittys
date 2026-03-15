import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { created, ok, serverError } from '@/lib/utils/api';

const schema = z.object({
  name: z.string().min(3),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value: z.coerce.number().nonnegative(),
  rules: z.record(z.any()).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    return ok(await prisma.promotion.findMany({ orderBy: { startAt: 'desc' } }));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.parse(await req.json());
    const promotion = await prisma.promotion.create({
      data: {
        ...parsed,
        startAt: new Date(parsed.startAt),
        endAt: new Date(parsed.endAt),
      },
    });
    return created(promotion);
  } catch (error) {
    return serverError(error);
  }
}
