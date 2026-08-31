import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, unauthorized, badRequest, notFound, serverError } from '@/lib/utils/api';
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

async function getOwnedAddress(userId: string, addressId: string) {
  return prisma.address.findFirst({
    where: { id: addressId, userId },
  });
}

/**
 * PATCH /api/account/addresses/[id]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const existing = await getOwnedAddress(user.id, params.id);
    if (!existing) return notFound('Dirección no encontrada');

    const data = AddressSchema.parse(await req.json());

    const region = data.region ?? existing.region;
    const commune = data.commune ?? existing.commune;
    if (data.region || data.commune) {
      if (!isValidChileCommune(region, commune)) {
        return badRequest('La comuna no corresponde a la región seleccionada');
      }
    }

    if (data.isDefault === true) {
      await prisma.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.update({
      where: { id: params.id },
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
    if (e instanceof z.ZodError) return badRequest('Datos de dirección inválidos', e.errors);
    return serverError(e);
  }
}

/**
 * DELETE /api/account/addresses/[id]
 * Desvincula pedidos (addressId nullable) y elimina la dirección.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(_req);
    if (!user) return unauthorized();

    const existing = await getOwnedAddress(user.id, params.id);
    if (!existing) return notFound('Dirección no encontrada');

    await prisma.$transaction([
      prisma.order.updateMany({
        where: { addressId: params.id },
        data: { addressId: null },
      }),
      prisma.address.delete({ where: { id: params.id } }),
    ]);

    if (existing.isDefault) {
      const next = await prisma.address.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
      });
      if (next) {
        await prisma.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
