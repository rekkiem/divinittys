import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, badRequest, notFound, serverError } from '@/lib/utils/api';
import { slugify } from '@/lib/utils/api';
import { sanitizeMultilineText, sanitizeText } from '@/lib/security/sanitize';

const VariantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.number().positive(),
  stock: z.number().int().min(0).default(0),
  isActive: z.boolean().optional().default(true),
});

const UpdateSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  shortDescription: z.string().nullable().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().nullable().optional(),
  basePrice: z.number().positive().optional(),
  comparePrice: z.number().positive().nullable().optional(),
  costPrice: z.number().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isOnSale: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  weight: z.number().positive().nullable().optional(),
  stock: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  trackStock: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  variants: z.array(VariantSchema).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await withAdmin(req);
  if (error) return error;

  try {
    const parsed = UpdateSchema.parse(await req.json());
    const data = {
      ...parsed,
      name: parsed.name ? sanitizeText(parsed.name) : undefined,
      slug: parsed.slug ? slugify(parsed.slug) : undefined,
      description: parsed.description
        ? sanitizeMultilineText(parsed.description)
        : parsed.description,
      shortDescription: parsed.shortDescription
        ? sanitizeText(parsed.shortDescription)
        : parsed.shortDescription,
      tags: parsed.tags?.map((tag) => sanitizeText(tag)).filter(Boolean),
    };
    const { stock, lowStockThreshold, trackStock, imageUrls, variants, ...productData } =
      data;

    if (
      productData.basePrice !== undefined &&
      productData.comparePrice !== undefined &&
      productData.comparePrice !== null &&
      productData.comparePrice <= productData.basePrice
    ) {
      return badRequest('El precio comparado debe ser mayor que el precio base');
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const p = await tx.product.update({
        where: { id: params.id },
        data: productData,
      });

      if (
        stock !== undefined ||
        lowStockThreshold !== undefined ||
        trackStock !== undefined
      ) {
        await tx.inventory.upsert({
          where: { productId: params.id },
          update: {
            ...(stock !== undefined && { stock }),
            ...(lowStockThreshold !== undefined && { lowStockThreshold }),
            ...(trackStock !== undefined && { trackStock }),
          },
          create: {
            productId: params.id,
            stock: stock ?? 0,
            lowStockThreshold: lowStockThreshold ?? 5,
            trackStock: trackStock ?? true,
          },
        });
      }

      if (imageUrls?.length) {
        const existingImgs = await tx.productImage.findMany({
          where: { productId: params.id },
          select: { url: true },
        });
        const existingUrls = new Set(existingImgs.map((i: { url: string }) => i.url));
        const existing = existingImgs.length;
        for (let i = 0; i < imageUrls.length; i++) {
          if (existingUrls.has(imageUrls[i])) continue;
          await tx.productImage.create({
            data: {
              productId: params.id,
              url: imageUrls[i],
              isMain: existing === 0 && i === 0,
              sortOrder: existing + i,
            },
          });
        }
      }

      // Sync variants when provided (tinturas / colores)
      if (variants !== undefined) {
        const keepIds = variants.filter((v) => v.id).map((v) => v.id as string);
        await tx.productVariant.deleteMany({
          where: {
            productId: params.id,
            ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
          },
        });
        for (const v of variants) {
          const row = {
            name: sanitizeText(v.name),
            sku: sanitizeText(v.sku),
            price: v.price,
            stock: v.stock,
            isActive: v.isActive ?? true,
          };
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: row,
            });
          } else {
            await tx.productVariant.create({
              data: { productId: params.id, ...row },
            });
          }
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await withAdmin(req);
  if (error) return error;
  try {
    const p = await prisma.product.findUnique({ where: { id: params.id } });
    if (!p) return notFound('Producto no encontrado');
    await prisma.product.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
