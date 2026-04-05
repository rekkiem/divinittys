import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, created, badRequest, serverError } from '@/lib/utils/api';
import { withAdmin } from '@/lib/admin-auth';

const PromotionSchema = z.object({
  title:       z.string().min(1),
  description: z.string().optional(),
  type:        z.enum(['BANNER', 'POPUP', 'EMAIL']),
  imageUrl:    z.string().url().optional(),
  linkUrl:     z.string().url().optional(),
  isActive:    z.boolean().default(true),
  startsAt:    z.string().datetime().optional(),
  endsAt:      z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const onlyActive = searchParams.get('active') === 'true';

    const promotions = await prisma.promotion.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return ok({ promotions });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await withAdmin(req);
  if (error) return error;

  try {
    const data = PromotionSchema.parse(await req.json());
    const promotion = await prisma.promotion.create({
      data: {
        ...data,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt:   data.endsAt   ? new Date(data.endsAt)   : null,
      },
    });
    return created({ promotion });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos', e.errors);
    return serverError(e);
  }
}
