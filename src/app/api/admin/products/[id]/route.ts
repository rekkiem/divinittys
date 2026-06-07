import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, badRequest, notFound, serverError } from '@/lib/utils/api';
import { slugify } from '@/lib/utils/api';
import { sanitizeMultilineText, sanitizeText } from '@/lib/security/sanitize';

const UpdateSchema = z.object({
  name:              z.string().min(2).optional(),
  slug:              z.string().optional(),
  description:       z.string().nullable().optional(),
  shortDescription:  z.string().nullable().optional(),
  categoryId:        z.string().optional(),
  brandId:           z.string().nullable().optional(),
  basePrice:         z.number().positive().optional(),
  comparePrice:      z.number().positive().nullable().optional(),
  costPrice:         z.number().positive().nullable().optional(),
  isActive:          z.boolean().optional(),
  isFeatured:        z.boolean().optional(),
  isOnSale:          z.boolean().optional(),
  tags:              z.array(z.string()).optional(),
  weight:            z.number().positive().nullable().optional(),
  stock:             z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  trackStock:        z.boolean().optional(),
  imageUrl:          z.string().url().nullable().optional(),
  imageUrls:         z.array(z.string().url()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await withAdmin(req);
  if (error) return error;

  try {
    const parsed = UpdateSchema.parse(await req.json());
    const data = {
      ...parsed,
      name: parsed.name ? sanitizeText(parsed.name) : undefined,
      slug: parsed.slug ? slugify(parsed.slug) : undefined,
      description: parsed.description ? sanitizeMultilineText(parsed.description) : parsed.description,
      shortDescription: parsed.shortDescription ? sanitizeText(parsed.shortDescription) : parsed.shortDescription,
      tags: parsed.tags?.map((tag) => sanitizeText(tag)).filter(Boolean),
    };
    const { stock, lowStockThreshold, trackStock, imageUrls, ...productData } = data;
    if (productData.basePrice !== undefined && productData.comparePrice !== undefined && productData.comparePrice !== null && productData.comparePrice <= productData.basePrice) {
      return badRequest('El precio comparado debe ser mayor que el precio base');
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const p = await tx.product.update({ where: { id: params.id }, data: productData });

      if (stock !== undefined || lowStockThreshold !== undefined || trackStock !== undefined) {
        await tx.inventory.upsert({
          where: { productId: params.id },
          update: {
            ...(stock !== undefined && { stock }),
            ...(lowStockThreshold !== undefined && { lowStockThreshold }),
            ...(trackStock !== undefined && { trackStock }),
          },
          create: {
            productId: params.id, stock: stock ?? 0,
            lowStockThreshold: lowStockThreshold ?? 5, trackStock: trackStock ?? true,
          },
        });
      }

      // If imageUrls passed, add new ones (don't delete existing)
      if (imageUrls?.length) {
        const existing = await tx.productImage.count({ where: { productId: params.id } });
        for (let i = 0; i < imageUrls.length; i++) {
          await tx.productImage.create({
            data: {
              productId: params.id, url: imageUrls[i],
              isMain: existing === 0 && i === 0, sortOrder: existing + i,
            },
          });
        }
      }

      return p;
    });

    return ok({ product: updated });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos', e.errors);
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await withAdmin(req);
  if (error) return error;
  try {
    const p = await prisma.product.findUnique({ where: { id: params.id } });
    if (!p) return notFound('Producto no encontrado');
    await prisma.product.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (e) { return serverError(e); }
}
