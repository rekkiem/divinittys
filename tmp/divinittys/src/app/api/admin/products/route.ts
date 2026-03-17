import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, created, badRequest, unauthorized, forbidden, serverError } from '@/lib/utils/api';
import { slugify } from '@/lib/utils/api';

const ProductSchema = z.object({
  sku:              z.string().min(1),
  name:             z.string().min(1),
  slug:             z.string().optional(),
  description:      z.string().nullable().optional(),
  shortDescription: z.string().nullable().optional(),
  categoryId:       z.string().min(1),
  brandId:          z.string().nullable().optional(),
  basePrice:        z.number().positive(),
  comparePrice:     z.number().positive().nullable().optional(),
  costPrice:        z.number().positive().nullable().optional(),
  isActive:         z.boolean().optional().default(true),
  isFeatured:       z.boolean().optional().default(false),
  isOnSale:         z.boolean().optional().default(false),
  tags:             z.array(z.string()).optional().default([]),
  weight:           z.number().positive().nullable().optional(),
  stock:            z.number().int().min(0).optional().default(0),
  lowStockThreshold: z.number().int().min(0).optional().default(5),
  trackStock:       z.boolean().optional().default(true),
});

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return null;
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return forbidden('Acceso denegado');

    const body = await req.json();
    const data = ProductSchema.parse(body);

    const slug = data.slug || slugify(data.name);

    // Check uniqueness
    const existing = await prisma.product.findFirst({
      where: { OR: [{ slug }, { sku: data.sku }] },
    });
    if (existing) {
      const field = existing.slug === slug ? 'slug' : 'SKU';
      return badRequest(`Ya existe un producto con ese ${field}`);
    }

    const product = await prisma.$transaction(async (tx: any) => {
      const p = await tx.product.create({
        data: {
          sku:             data.sku,
          name:            data.name,
          slug,
          description:     data.description,
          shortDescription: data.shortDescription,
          categoryId:      data.categoryId,
          brandId:         data.brandId,
          basePrice:       data.basePrice,
          comparePrice:    data.comparePrice,
          costPrice:       data.costPrice,
          isActive:        data.isActive,
          isFeatured:      data.isFeatured,
          isOnSale:        data.isOnSale,
          tags:            data.tags,
          weight:          data.weight,
        },
      });
      await tx.inventory.create({
        data: {
          productId:         p.id,
          stock:             data.stock,
          lowStockThreshold: data.lowStockThreshold,
          trackStock:        data.trackStock,
        },
      });
      return p;
    });

    return created({ product });
  } catch (error) {
    if (error instanceof z.ZodError) return badRequest('Datos inválidos', error.errors);
    return serverError(error);
  }
}
