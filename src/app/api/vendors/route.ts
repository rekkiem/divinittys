import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { created, ok, serverError, unauthorized } from '@/lib/utils/api';
import { getAuthUser } from '@/lib/auth';
import { slugify } from '@/lib/utils/api';

const schema = z.object({
  storeName: z.string().min(2),
  description: z.string().optional(),
  logo: z.string().optional(),
});

export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(vendors);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return unauthorized('Datos inválidos');

    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        storeName: parsed.data.storeName,
        slug: slugify(parsed.data.storeName),
        description: parsed.data.description,
        logo: parsed.data.logo,
        commissionRate: Number(process.env.VENDOR_COMMISSION_DEFAULT || 0.15),
      },
    });

    return created(vendor);
  } catch (error) {
    return serverError(error);
  }
}
