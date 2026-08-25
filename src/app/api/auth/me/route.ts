import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, unauthorized, serverError } from '@/lib/utils/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const user = await prisma.user.findFirst({
      where: { id: auth.id, isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatar: true,
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
          take: 5,
        },
      },
    });
    if (!user) return unauthorized();

    const lastOrder = await prisma.order.findFirst({
      where: { OR: [{ userId: user.id }, { guestEmail: user.email }] },
      orderBy: { createdAt: 'desc' },
      select: { shippingData: true },
    });

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
      },
      addresses: user.addresses,
      lastShipping: lastOrder?.shippingData ?? null,
    });
  } catch (e) {
    return serverError(e);
  }
}
