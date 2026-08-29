import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { withAdmin, isAdminUser } from '@/lib/admin-auth';
import { ok, badRequest, notFound, serverError, forbidden } from '@/lib/utils/api';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  isActive: z.boolean().optional(),
});

async function getClientOr404(id: string) {
  return prisma.user.findFirst({
    where: { id, role: 'CUSTOMER' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      passwordHash: true,
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
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await withAdmin(req);
    if (!isAdminUser(user) || error) return error!;

    const client = await getClientOr404(params.id);
    if (!client) return notFound('Cliente no encontrado');

    const { passwordHash, ...safe } = client;
    return ok({
      client: {
        ...safe,
        hasPassword: Boolean(passwordHash),
      },
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await withAdmin(req);
    if (!isAdminUser(user) || error) return error!;

    const existing = await prisma.user.findFirst({
      where: { id: params.id, role: 'CUSTOMER' },
      select: { id: true },
    });
    if (!existing) return notFound('Cliente no encontrado');

    const body = await req.json();
    const action = body?.action as string | undefined;

    // ─── Reset password ───
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
      // Invalidar sesiones activas del cliente
      await prisma.session.deleteMany({ where: { userId: params.id } });
      return ok({
        message: 'Contraseña reiniciada. Se cerraron las sesiones activas.',
        tempPassword,
      });
    }

    // ─── Update perfil / isActive ───
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

    // Si se inactiva, cerrar sesiones
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
  try {
    const { user, error } = await withAdmin(req);
    if (!isAdminUser(user) || error) return error!;

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

    // Cascade: addresses, sessions, accounts, wishlist, reviews, hairProfile
    await prisma.user.delete({ where: { id: params.id } });
    return ok({ message: 'Cliente eliminado' });
  } catch (e) {
    return serverError(e);
  }
}
