import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { created, ok, serverError, unauthorized } from '@/lib/utils/api';
import { getAuthUser } from '@/lib/auth';
import { slugify } from '@/lib/utils/api';
import { enqueueProductIndex } from '@/lib/queue/search.queue';

const createSchema = z.object({
  sku: z.string().min(3),
  name: z.string().min(3),
  description: z.string().optional(),
  categoryId: z.string(),
  brandId: z.string().optional(),
  basePrice: z.coerce.number().positive(),
});

async function getVendor(userId: string) {
  return prisma.vendor.findUnique({ where: { userId } });
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const vendor = await getVendor(user.id);
    if (!vendor) return unauthorized('Vendor no registrado');

    const products = await prisma.product.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
      include: { images: true, inventory: true },
    });

    return ok(products);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const vendor = await getVendor(user.id);
    if (!vendor) return unauthorized('Vendor no registrado');

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return unauthorized('Datos inválidos');

    const product = await prisma.product.create({
      data: {
        ...parsed.data,
        slug: slugify(parsed.data.name),
        tags: [],
        vendorId: vendor.id,
        vendorSku: parsed.data.sku,
      },
    });

    await enqueueProductIndex(product.id);
    return created(product);
  } catch (error) {
    return serverError(error);
  }
}
