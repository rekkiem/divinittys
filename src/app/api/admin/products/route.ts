import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, created, badRequest, serverError } from '@/lib/utils/api';
import { slugify } from '@/lib/utils/api';

const ProductSchema = z.object({
  sku:               z.string().min(1),
  name:              z.string().min(2),
  slug:              z.string().optional(),
  description:       z.string().nullable().optional(),
  shortDescription:  z.string().nullable().optional(),
  categoryId:        z.string().min(1),
  brandId:           z.string().nullable().optional(),
  basePrice:         z.number().positive('El precio debe ser mayor a 0'),
  comparePrice:      z.number().positive().nullable().optional(),
  costPrice:         z.number().positive().nullable().optional(),
  isActive:          z.boolean().default(true),
  isFeatured:        z.boolean().default(false),
  isOnSale:          z.boolean().default(false),
  tags:              z.array(z.string()).default([]),
  weight:            z.number().positive().nullable().optional(),
  stock:             z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  trackStock:        z.boolean().default(true),
  // MinIO image fields
  imageUrl:          z.string().url().nullable().optional(),
  imageUrls:         z.array(z.string().url()).optional(),
});

export async function POST(req: NextRequest) {
  const { user, error } = await withAdmin(req);
  if (error) return error;

  try {
    const body = await req.json();
    const data = ProductSchema.parse(body);
    const slug = data.slug || slugify(data.name);

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
          sku: data.sku, name: data.name, slug,
          description: data.description, shortDescription: data.shortDescription,
          categoryId: data.categoryId, brandId: data.brandId,
          basePrice: data.basePrice, comparePrice: data.comparePrice,
          costPrice: data.costPrice, isActive: data.isActive,
          isFeatured: data.isFeatured, isOnSale: data.isOnSale,
          tags: data.tags, weight: data.weight,
          imageUrl: data.imageUrl ?? null,
        },
      });

      await tx.inventory.create({
        data: {
          productId: p.id, stock: data.stock,
          lowStockThreshold: data.lowStockThreshold, trackStock: data.trackStock,
        },
      });

      // Persist uploaded image URLs as ProductImage records
      const urls = data.imageUrls?.length ? data.imageUrls : data.imageUrl ? [data.imageUrl] : [];
      for (let i = 0; i < urls.length; i++) {
        await tx.productImage.create({
          data: {
            productId: p.id,
            url:       urls[i],
            isMain:    i === 0,
            sortOrder: i,
          },
        });
      }

      return p;
    });

    return created({ product });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos', e.errors);
    return serverError(e);
  }
}
