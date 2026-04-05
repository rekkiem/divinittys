import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, created, badRequest, unauthorized, serverError } from '@/lib/utils/api';
import { getAuthUser } from '@/lib/auth';
import { slugify } from '@/lib/utils/api';

async function getVendorFromRequest(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return null;
  return prisma.vendor.findUnique({ where: { userId: user.id } });
}

export async function GET(req: NextRequest) {
  try {
    const vendor = await getVendorFromRequest(req);
    if (!vendor) return unauthorized('Debes ser un vendedor registrado');

    const products = await prisma.product.findMany({
      where:   { vendorId: vendor.id },
      include: { inventory: { select: { stock: true } }, images: { where: { isMain: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });

    return ok({ products });
  } catch (e) {
    return serverError(e);
  }
}

const ProductSchema = z.object({
  name:        z.string().min(2),
  description: z.string().optional(),
  basePrice:   z.number().positive(),
  comparePrice: z.number().positive().optional(),
  categoryId:  z.string().min(1),
  stock:       z.number().int().min(0).default(0),
  tags:        z.array(z.string()).default([]),
  sku:         z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const vendor = await getVendorFromRequest(req);
    if (!vendor) return unauthorized('Debes ser un vendedor registrado');

    const data = ProductSchema.parse(await req.json());
    const slug = slugify(data.name);
    const sku  = data.sku || `VND-${vendor.id.slice(0,6)}-${Date.now()}`;

    const product = await prisma.$transaction(async (tx: any) => {
      const p = await tx.product.create({
        data: {
          name:        data.name,
          slug,
          sku,
          description: data.description,
          basePrice:   data.basePrice,
          comparePrice: data.comparePrice,
          categoryId:  data.categoryId,
          vendorId:    vendor.id,
          tags:        data.tags,
          isActive:    false,  // Vendor products start inactive, admin must approve
        },
      });
      await tx.inventory.create({
        data: { productId: p.id, stock: data.stock, lowStockThreshold: 5, trackStock: true },
      });
      return p;
    });

    return created({ product });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos', e.errors);
    return serverError(e);
  }
}
