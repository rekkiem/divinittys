import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, serverError } from '@/lib/utils/api';
import { getCache, setCache } from '@/lib/redis/client';
import { searchProducts } from '@/lib/search/meilisearch';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(24),
  cursor: z.string().optional(),
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
    const cacheKey = `products:v2:${searchParams.toString()}`;
    const cached = await getCache(cacheKey);
    if (cached) return ok(cached);

    // Búsqueda full-text con Meilisearch si hay query
    if (params.q && !params.ids) {
      const filters: string[] = ['isActive = true'];
      if (params.category) filters.push(`categorySlug = \"${params.category}\"`);
      if (params.brand) filters.push(`brandSlug = \"${params.brand}\"`);
      if (params.onSale !== undefined) filters.push(`isOnSale = ${params.onSale}`);
      if (params.featured !== undefined) filters.push(`isFeatured = ${params.featured}`);

      const sortMap: Record<string, string[]> = {
        newest: ['createdAt:desc'],
        price_asc: ['basePrice:asc'],
        price_desc: ['basePrice:desc'],
        name_asc: ['name:asc'],
        featured: ['isFeatured:desc', 'createdAt:desc'],
      };

      const result = await searchProducts(params.q, {
        limit: params.limit,
        filter: filters,
        sort: sortMap[params.sort],
        facets: ['categorySlug', 'brandSlug'],
      });

      const data = {
        products: result.hits,
        pagination: {
          total: result.estimatedTotalHits || result.hits.length,
          page: params.page,
          limit: params.limit,
          hasNext: false,
          hasPrev: params.page > 1,
        },
        facets: result.facetDistribution || {},
      };
      await setCache(cacheKey, data, 60);
      return ok(data);
    }

    const take = params.limit;
    const where: any = { isActive: true };

    if (params.category) where.category = { slug: params.category };
    if (params.brand) where.brand = { slug: params.brand };
    if (params.featured !== undefined) where.isFeatured = params.featured;
    if (params.onSale !== undefined) where.isOnSale = params.onSale;
    if (params.ids) {
      const idList = params.ids.split(',').filter(Boolean);
      if (idList.length > 0) where.id = { in: idList };
    }
    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.basePrice = {};
      if (params.minPrice !== undefined) where.basePrice.gte = params.minPrice;
      if (params.maxPrice !== undefined) where.basePrice.lte = params.maxPrice;
    }

    const orderBy: any[] = [];
    switch (params.sort) {
      case 'newest': orderBy.push({ createdAt: 'desc' }); break;
      case 'price_asc': orderBy.push({ basePrice: 'asc' }); break;
      case 'price_desc': orderBy.push({ basePrice: 'desc' }); break;
      case 'name_asc': orderBy.push({ name: 'asc' }); break;
      case 'featured': orderBy.push({ isFeatured: 'desc' }, { createdAt: 'desc' }); break;
    }

    const products = await prisma.product.findMany({
      where,
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        vendor: { select: { id: true, storeName: true, slug: true } },
        images: { where: { isMain: true }, take: 1 },
        inventory: { select: { stock: true } },
      },
    });

    const hasNext = products.length > take;
    const items = hasNext ? products.slice(0, take) : products;

    const data = {
      products: items,
      pagination: {
        total: items.length,
        page: params.page,
        limit: params.limit,
        hasNext,
        hasPrev: Boolean(params.cursor) || params.page > 1,
        nextCursor: hasNext ? items[items.length - 1].id : null,
      },
    };

    await setCache(cacheKey, data, 60);
    return ok(data);
  } catch (error) {
    return serverError(error);
  }
}
