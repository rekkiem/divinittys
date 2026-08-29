import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdmin, isAdminUser } from '@/lib/admin-auth';
import { ok, badRequest, notFound, serverError, forbidden } from '@/lib/utils/api';
import { isValidChileCommune } from '@/lib/chile/geo';

export const dynamic = 'force-dynamic';

const AddressSchema = z.object({
  label: z.string().max(40).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  street: z.string().min(1).optional(),
  number: z.string().min(1).optional(),
  apartment: z.string().nullable().optional(),
  commune: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  postalCode: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; addressId: string } }
) {
  try {
    const { user, error } = await withAdmin(req);
    if (!isAdminUser(user) || error) return error!;

    const existing = await prisma.address.findFirst({
      where: { id: params.addressId, userId: params.id },
    });
    if (!existing) return notFound('Dirección no encontrada');

    const data = AddressSchema.parse(await req.json());
    const region = data.region ?? existing.region;
    const commune = data.commune ?? existing.commune;
    if (!isValidChileCommune(region, commune)) {
      return badRequest('La comuna no corresponde a la región seleccionada');
    }

    if (data.isDefault === true) {
      await prisma.address.updateMany({
        where: { userId: params.id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.update({
      where: { id: params.addressId },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.street !== undefined ? { street: data.street } : {}),
        ...(data.number !== undefined ? { number: data.number } : {}),
        ...(data.apartment !== undefined ? { apartment: data.apartment } : {}),
        ...(data.commune !== undefined ? { commune: data.commune } : {}),
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(data.region !== undefined ? { region: data.region } : {}),
        ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      },
    });
    return ok({ address });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos', e.errors);
    return serverError(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; addressId: string } }
) {
  try {
    const { user, error } = await withAdmin(req);
    if (!isAdminUser(user) || error) return error!;

    const existing = await prisma.address.findFirst({
      where: { id: params.addressId, userId: params.id },
      include: { _count: { select: { orders: true } } },
    });
    if (!existing) return notFound('Dirección no encontrada');

    if (existing._count.orders > 0) {
      return forbidden(
        `No se puede eliminar: esta dirección está asociada a ${existing._count.orders} pedido(s).`
      );
    }

    await prisma.address.delete({ where: { id: params.addressId } });

    // Si era default, promover otra
    if (existing.isDefault) {
      const next = await prisma.address.findFirst({
        where: { userId: params.id },
        orderBy: { updatedAt: 'desc' },
      });
      if (next) {
        await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    return ok({ message: 'Dirección eliminada' });
  } catch (e) {
    return serverError(e);
  }
}
