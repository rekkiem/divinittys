import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, notFound, serverError } from '@/lib/utils/api';

// GET — public (storefront)
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const product = await prisma.product.findFirst({
      where: { slug: params.slug, isActive: true },
      include: {
        category: true, brand: true,
        images: { orderBy: { sortOrder: 'asc' } },
        attributes: true,
        variants: { where: { isActive: true } },
        inventory: true,
        reviews: {
          where: { status: 'APPROVED' },
          include: { user: { select: { name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' }, take: 10,
        },
      },
    });
    if (!product) return notFound('Producto no encontrado');

    const [ratingData, related] = await Promise.all([
      prisma.review.aggregate({
        where: { productId: product.id, status: 'APPROVED' },
        _avg: { rating: true }, _count: { rating: true },
      }),
      prisma.product.findMany({
        where: { categoryId: product.categoryId, isActive: true, NOT: { id: product.id } },
        take: 6,
        include: { images: { where: { isMain: true }, take: 1 }, inventory: { select: { stock: true } }, brand: { select: { name: true } } },
      }),
    ]);

    return ok({ product, rating: { avg: ratingData._avg.rating || 0, count: ratingData._count.rating }, related });
  } catch (error) { return serverError(error); }
}

// PATCH — admin only
export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  const { user, error } = await withAdmin(req);
  if (error) return error;
  try {
    const body = await req.json();
    const product = await prisma.product.update({ where: { slug: params.slug }, data: body });
    return ok(product);
  } catch (e) { return serverError(e); }
}

// DELETE — admin only
export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const { user, error } = await withAdmin(req);
  if (error) return error;
  try {
    await prisma.product.delete({ where: { slug: params.slug } });
    return ok({ deleted: true });
  } catch (e) { return serverError(e); }
}
