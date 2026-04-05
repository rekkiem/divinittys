import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, created, badRequest, serverError } from '@/lib/utils/api';
import { withAdmin } from '@/lib/admin-auth';
import { getAuthUser } from '@/lib/auth';
import { slugify } from '@/lib/utils/api';

export async function GET(req: NextRequest) {
  const { user, error } = await withAdmin(req);
  if (error) return error;

  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        user:   { select: { email: true, name: true } },
        _count: { select: { products: true, payouts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok({ vendors });
  } catch (e) {
    return serverError(e);
  }
}

const CreateVendorSchema = z.object({
  userId:      z.string().min(1),
  shopName:    z.string().min(2),
  description: z.string().optional(),
  commission:  z.number().min(0).max(1).optional(),
});

export async function POST(req: NextRequest) {
  const { user, error } = await withAdmin(req);
  if (error) return error;

  try {
    const data = CreateVendorSchema.parse(await req.json());

    const slug = slugify(data.shopName);
    const vendor = await prisma.vendor.create({
      data: {
        userId:      data.userId,
        shopName:    data.shopName,
        slug,
        description: data.description,
        commission:  data.commission ?? 0.15,
      },
    });

    return created({ vendor });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos', e.errors);
    return serverError(e);
  }
}
