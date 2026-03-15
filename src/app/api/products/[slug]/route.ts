import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, notFound, serverError } from '@/lib/utils/api';
import { enqueueProductDelete, enqueueProductIndex } from '@/lib/queue/search.queue';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const product = await prisma.product.findFirst({
      where: { slug: params.slug, isActive: true },
      include: {
        category: true,
        brand: true,
      vendor: true,
        images: { orderBy: { sortOrder: 'asc' } },
        attributes: true,
        variants: { where: { isActive: true } },
        inventory: true,
        reviews: {
          where: { status: 'APPROVED' },
          include: {
            user: { select: { name: true, avatar: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) return notFound('Producto no encontrado');

    // Calculate avg rating
    const ratingData = await prisma.review.aggregate({
      where: { productId: product.id, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Related products
    const related = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        isActive: true,
        NOT: { id: product.id },
      },
      take: 6,
      include: {
        images: { where: { isMain: true }, take: 1 },
        inventory: { select: { stock: true } },
        brand: { select: { name: true } },
      },
    });

    return ok({
      product,
      rating: {
        avg: ratingData._avg.rating || 0,
        count: ratingData._count.rating,
      },
      related,
    });
  } catch (error) {
    return serverError(error);
  }
}

// PATCH - Update product (Admin)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await req.json();
    const product = await prisma.product.update({
      where: { slug: params.slug },
      data: body,
    });
    await enqueueProductIndex(product.id);
    return ok(product);
  } catch (error) {
    return serverError(error);
  }
}

// DELETE - Delete product (Admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const deleted = await prisma.product.delete({ where: { slug: params.slug } });
    await enqueueProductDelete(deleted.id);
    return ok({ message: 'Producto eliminado' });
  } catch (error) {
    return serverError(error);
  }
}
