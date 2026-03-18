import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, badRequest, notFound, serverError } from '@/lib/utils/api';

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
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await withAdmin(req);
  if (error) return error;

  try {
    const data = UpdateSchema.parse(await req.json());
    const { stock, lowStockThreshold, trackStock, ...productData } = data;

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
          create: { productId: params.id, stock: stock ?? 0, lowStockThreshold: lowStockThreshold ?? 5, trackStock: trackStock ?? true },
        });
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
  } catch (e) {
    return serverError(e);
  }
}
