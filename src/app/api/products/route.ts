import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, badRequest, serverError, paginate, paginationMeta } from '@/lib/utils/api';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(24),
  q: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'name_asc', 'featured']).default('newest'),
  featured: z.coerce.boolean().optional(),
  onSale: z.coerce.boolean().optional(),
  ids: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = querySchema.parse(Object.fromEntries(searchParams));
    const { take, skip } = paginate(params.page, params.limit);

    const where: any = { isActive: true };

    // Search
    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { description: { contains: params.q, mode: 'insensitive' } },
        { sku: { contains: params.q, mode: 'insensitive' } },
        { tags: { has: params.q.toLowerCase() } },
        { brand: { name: { contains: params.q, mode: 'insensitive' } } },
      ];
    }

    // Filters
    if (params.category) {
      where.category = { slug: params.category };
    }
    if (params.brand) {
      where.brand = { slug: params.brand };
    }
    if (params.featured !== undefined) {
      where.isFeatured = params.featured;
    }
    if (params.onSale !== undefined) {
      where.isOnSale = params.onSale;
    }
    if (params.ids) {
      const idList = params.ids.split(',').filter(Boolean);
      if (idList.length > 0) where.id = { in: idList };
    }
    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.basePrice = {};
      if (params.minPrice !== undefined) where.basePrice.gte = params.minPrice;
      if (params.maxPrice !== undefined) where.basePrice.lte = params.maxPrice;
    }

    // Sort
    const orderBy: any[] = [];
    switch (params.sort) {
      case 'newest':      orderBy.push({ createdAt: 'desc' }); break;
      case 'price_asc':   orderBy.push({ basePrice: 'asc' }); break;
      case 'price_desc':  orderBy.push({ basePrice: 'desc' }); break;
      case 'name_asc':    orderBy.push({ name: 'asc' }); break;
      case 'featured':    orderBy.push({ isFeatured: 'desc' }, { createdAt: 'desc' }); break;
    }

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        take,
        skip,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          images: { where: { isMain: true }, take: 1 },
          inventory: { select: { stock: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return ok({
      products,
      pagination: paginationMeta(total, params.page, params.limit),
    });
  } catch (error) {
    return serverError(error);
  }
}
