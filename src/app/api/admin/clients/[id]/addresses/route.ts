import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, created, badRequest, notFound, serverError } from '@/lib/utils/api';
import { isValidChileCommune } from '@/lib/chile/geo';

export const dynamic = 'force-dynamic';

const AddressSchema = z.object({
  label: z.string().max(40).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  street: z.string().min(1),
  number: z.string().min(1),
  apartment: z.string().nullable().optional(),
  commune: z.string().min(1),
  city: z.string().min(1),
  region: z.string().min(1),
  postalCode: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
});

async function ensureCustomer(id: string) {
  return prisma.user.findFirst({
    where: { id, role: 'CUSTOMER' },
    select: { id: true },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await withAdmin(req);
  if (error) return error;

  try {
    if (!(await ensureCustomer(params.id))) return notFound('Cliente no encontrado');

    const addresses = await prisma.address.findMany({
      where: { userId: params.id },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return ok({ addresses });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await withAdmin(req);
  if (error) return error;

  try {
    if (!(await ensureCustomer(params.id))) return notFound('Cliente no encontrado');

    const data = AddressSchema.parse(await req.json());
    if (!isValidChileCommune(data.region, data.commune)) {
      return badRequest('La comuna no corresponde a la región seleccionada');
    }

    if (data.isDefault !== false) {
      await prisma.address.updateMany({
        where: { userId: params.id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId: params.id,
        label: data.label || 'Casa',
        firstName: data.firstName,
        lastName: data.lastName,
        street: data.street,
        number: data.number,
        apartment: data.apartment ?? null,
        commune: data.commune,
        city: data.city,
        region: data.region,
        postalCode: data.postalCode ?? null,
        phone: data.phone ?? null,
        isDefault: data.isDefault !== false,
      },
    });
    return created({ address });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos de dirección inválidos', e.errors);
    return serverError(e);
  }
}
