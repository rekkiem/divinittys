import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, badRequest, serverError, paginate } from '@/lib/utils/api';
import { searchProducts } from '@/lib/search/meilisearch';

// GET — public product listing with Meilisearch + SQL fallback
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q        = searchParams.get('q') || '';
    const page     = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit    = Math.min(48, parseInt(searchParams.get('limit') || '20'));
    const category = searchParams.get('category') || undefined;
    const brand    = searchParams.get('brand') || undefined;
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined;
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined;
    const sort     = (searchParams.get('sort') || 'newest') as any;
    const featured = searchParams.get('featured') === 'true';
    const onSale   = searchParams.get('onSale') === 'true';
    const ids      = searchParams.get('ids')?.split(',').filter(Boolean);

    if (q && !ids && !featured) {
      const meiliResult = await searchProducts({ q, page, limit, category, brand, minPrice, maxPrice, onSale, sort });
      if (meiliResult) {
        return ok({
          products: meiliResult.hits,
          pagination: { page, limit, total: meiliResult.total, pages: Math.ceil(meiliResult.total / limit) },
          facets: meiliResult.facets,
          source: 'meilisearch',
        });
      }
    }

    const where: any = { isActive: true };
    if (ids?.length)  { where.id = { in: ids }; }
    else {
      if (q)        where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }];
      if (category) where.category = { slug: category };
      if (brand)    where.brand    = { slug: brand };
      if (featured) where.isFeatured = true;
      if (onSale)   where.comparePrice = { not: null };
      if (minPrice !== undefined || maxPrice !== undefined) {
        where.basePrice = {};
        if (minPrice !== undefined) where.basePrice.gte = minPrice;
        if (maxPrice !== undefined) where.basePrice.lte = maxPrice;
      }
    }

    const sortMap: Record<string, object> = {
      newest: { createdAt: 'desc' }, oldest: { createdAt: 'asc' },
      price_asc: { basePrice: 'asc' }, price_desc: { basePrice: 'desc' },
      name_asc: { name: 'asc' },
    };
    const { skip, take } = paginate(page, limit);
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where, orderBy: sortMap[sort] || { createdAt: 'desc' }, skip, take,
        include: {
          category: { select: { name: true, slug: true } },
          brand: { select: { name: true, slug: true } },
          images: { take: 2, orderBy: { position: 'asc' } },
          inventory: { select: { stock: true } },
        },
      }),
    ]);

    return ok({ products, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, source: 'database' });
  } catch (error) {
    if (error instanceof z.ZodError) return badRequest('Parámetros inválidos');
    return serverError(error);
  }
}
// NOTE: POST (create product) is at /api/admin/products — requires ADMIN role
