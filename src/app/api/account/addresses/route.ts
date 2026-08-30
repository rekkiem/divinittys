import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, created, unauthorized, badRequest, serverError } from '@/lib/utils/api';
import { isValidChileCommune } from '@/lib/chile/geo';

export const dynamic = 'force-dynamic';

const AddressSchema = z.object({
  label: z.string().max(40).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  street: z.string().min(1),
  number: z.string().min(1),
  apartment: z.string().optional(),
  commune: z.string().min(1),
  city: z.string().min(1),
  region: z.string().min(1),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const addresses = await prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return ok({ addresses });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const data = AddressSchema.parse(await req.json());
    if (!isValidChileCommune(data.region, data.commune)) {
      return badRequest('La comuna no corresponde a la región seleccionada');
    }
    if (data.isDefault !== false) {
      await prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    }
    const address = await prisma.address.create({
      data: {
        userId: user.id,
        label: data.label || 'Casa',
        firstName: data.firstName,
        lastName: data.lastName,
        street: data.street,
        number: data.number,
        apartment: data.apartment,
        commune: data.commune,
        city: data.city,
        region: data.region,
        postalCode: data.postalCode,
        phone: data.phone,
        isDefault: data.isDefault !== false,
      },
    });
    return created({ address });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos de dirección inválidos', e.errors);
    return serverError(e);
  }
}
