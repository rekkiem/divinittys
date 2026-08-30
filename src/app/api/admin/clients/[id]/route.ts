import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, badRequest, notFound, serverError, forbidden } from '@/lib/utils/api';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  isActive: z.boolean().optional(),
});

async function getClientOr404(id: string) {
  // No seleccionar passwordHash: evita P2032 con filas NULL (OAuth).
  const [client, hasPassword] = await Promise.all([
    prisma.user.findFirst({
      where: { id, role: 'CUSTOMER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            total: true,
            createdAt: true,
          },
        },
        _count: { select: { orders: true, addresses: true } },
      },
    }),
    prisma.user
      .count({ where: { id, role: 'CUSTOMER', passwordHash: { not: null } } })
      .then((c) => c > 0),
  ]);

  return client ? { ...client, hasPassword } : null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await withAdmin(req);
  if (error) return error;

  try {
    const client = await getClientOr404(params.id);
    if (!client) return notFound('Cliente no encontrado');
    return ok({ client });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await withAdmin(req);
  if (error) return error;

  try {
    const existing = await prisma.user.findFirst({
      where: { id: params.id, role: 'CUSTOMER' },
      select: { id: true },
    });
    if (!existing) return notFound('Cliente no encontrado');

    const body = await req.json();
    const action = body?.action as string | undefined;

    if (action === 'reset-password') {
      const tempPassword =
        typeof body.tempPassword === 'string' && body.tempPassword.length >= 8
          ? body.tempPassword
          : `Div${Math.random().toString(36).slice(2, 8)}A1`;
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      await prisma.user.update({
        where: { id: params.id },
        data: { passwordHash },
      });
      await prisma.session.deleteMany({ where: { userId: params.id } });
      return ok({
        message: 'Contraseña reiniciada. Se cerraron las sesiones activas.',
        tempPassword,
      });
    }

    const data = updateSchema.parse(body);
    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (data.isActive === false) {
      await prisma.session.deleteMany({ where: { userId: params.id } });
    }

    return ok({ client: updated });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos', e.errors);
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await withAdmin(req);
  if (error) return error;

  try {
    const client = await prisma.user.findFirst({
      where: { id: params.id, role: 'CUSTOMER' },
      select: {
        id: true,
        _count: { select: { orders: true } },
      },
    });
    if (!client) return notFound('Cliente no encontrado');

    if (client._count.orders > 0) {
      return forbidden(
        `No se puede eliminar: el cliente tiene ${client._count.orders} pedido(s). Inactívalo en su lugar.`
      );
    }

    await prisma.user.delete({ where: { id: params.id } });
    return ok({ message: 'Cliente eliminado' });
  } catch (e) {
    return serverError(e);
  }
}
