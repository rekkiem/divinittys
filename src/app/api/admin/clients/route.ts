import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, isAdminUser } from '@/lib/admin-auth';
import { ok, serverError } from '@/lib/utils/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await withAdmin(req);
    if (!isAdminUser(user) || error) return error!;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    const status = searchParams.get('status'); // active | inactive | all

    const where: any = { role: 'CUSTOMER' };
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const clients = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            addresses: true,
          },
        },
      },
    });

    return ok({ clients });
  } catch (e) {
    return serverError(e);
  }
}
