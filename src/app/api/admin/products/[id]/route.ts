import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, badRequest, forbidden, notFound, serverError } from '@/lib/utils/api';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;
  return user;
}

const UpdateSchema = z.object({
  name:             z.string().min(1).optional(),
  slug:             z.string().optional(),
  description:      z.string().nullable().optional(),
  shortDescription: z.string().nullable().optional(),
  categoryId:       z.string().optional(),
  brandId:          z.string().nullable().optional(),
  basePrice:        z.number().positive().optional(),
  comparePrice:     z.number().positive().nullable().optional(),
  costPrice:        z.number().positive().nullable().optional(),
  isActive:         z.boolean().optional(),
  isFeatured:       z.boolean().optional(),
  isOnSale:         z.boolean().optional(),
  tags:             z.array(z.string()).optional(),
  weight:           z.number().positive().nullable().optional(),
  stock:            z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  trackStock:       z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return forbidden('Acceso denegado');

    const body = await req.json();
    const data = UpdateSchema.parse(body);

    const { stock, lowStockThreshold, trackStock, ...productData } = data;

    const product = await prisma.$transaction(async (tx: any) => {
      const p = await tx.product.update({
        where: { id: params.id },
        data: productData,
      });
      // Update inventory if stock fields provided
      if (stock !== undefined || lowStockThreshold !== undefined || trackStock !== undefined) {
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
      return p;
    });

    return ok({ product });
  } catch (error) {
    if (error instanceof z.ZodError) return badRequest('Datos inválidos', error.errors);
    return serverError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return forbidden('Acceso denegado');

    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) return notFound('Producto no encontrado');

    await prisma.product.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
