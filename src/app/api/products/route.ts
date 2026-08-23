import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { normalizeProductsMedia } from '@/lib/images';
import { ok, badRequest, serverError, paginate } from '@/lib/utils/api';
import { searchProducts, type MeiliProduct } from '@/lib/search/meilisearch';

export const dynamic = 'force-dynamic';

/** Uniformiza hits de Meilisearch al shape que espera el frontend (ProductCard / SearchModal) */
function meiliHitsToProducts(hits: MeiliProduct[]) {
  return hits.map((h) => ({
    id: h.id,
    name: h.name,
    slug: h.slug,
    description: h.description,
    sku: h.sku,
    basePrice: h.basePrice,
    comparePrice: h.comparePrice,
    isActive: h.isActive,
    isFeatured: h.isFeatured,
    isOnSale: h.isOnSale,
    imageUrl: h.imageUrl,
    images: h.imageUrl ? [{ url: h.imageUrl, isMain: true }] : [],
    brand: h.brand ? { name: h.brand, slug: h.brandSlug || undefined } : null,
    category: h.category
      ? { name: h.category, slug: h.categorySlug || undefined }
      : null,
    inventory: { stock: typeof h.stock === 'number' ? h.stock : 0 },
    tags: h.tags || [],
  }));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const q = searchParams.get('q') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(48, parseInt(searchParams.get('limit') || '20', 10) || 20);
    const category = searchParams.get('category') || undefined;
    const brand = searchParams.get('brand') || undefined;
    const minPrice = searchParams.get('minPrice')
      ? parseFloat(searchParams.get('minPrice')!)
      : undefined;
    const maxPrice = searchParams.get('maxPrice')
      ? parseFloat(searchParams.get('maxPrice')!)
      : undefined;
    const sort = (searchParams.get('sort') || 'newest') as any;
    const featured = searchParams.get('featured') === 'true';
    const onSale = searchParams.get('onSale') === 'true';
    const ids = searchParams.get('ids')?.split(',').filter(Boolean);

    if (q && !ids && !featured) {
      const meiliResult = await searchProducts({
        q,
        page,
        limit,
        category,
        brand,
        minPrice,
        maxPrice,
        onSale,
        sort,
      });
      if (meiliResult) {
        const products = normalizeProductsMedia(meiliHitsToProducts(meiliResult.hits));
        return ok({
          products,
          pagination: {
            page,
            limit,
            total: meiliResult.total,
            pages: Math.max(1, Math.ceil(meiliResult.total / limit)),
          },
          facets: meiliResult.facets,
          source: 'meilisearch',
        });
      }
    }

    const where: any = { isActive: true };
    if (ids?.length) {
      where.id = { in: ids };
    } else {
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { brand: { name: { contains: q, mode: 'insensitive' } } },
        ];
      }
      if (category) where.category = { slug: category };
      if (brand) where.brand = { slug: brand };
      if (featured) where.isFeatured = true;
      if (onSale) where.isOnSale = true;
      if (minPrice !== undefined || maxPrice !== undefined) {
        where.basePrice = {};
        if (minPrice !== undefined) where.basePrice.gte = minPrice;
        if (maxPrice !== undefined) where.basePrice.lte = maxPrice;
      }
    }

    const sortMap: Record<string, object> = {
      newest: { createdAt: 'desc' },
      oldest: { createdAt: 'asc' },
      price_asc: { basePrice: 'asc' },
      price_desc: { basePrice: 'desc' },
      name_asc: { name: 'asc' },
      featured: { isFeatured: 'desc' },
    };
    const { skip, take } = paginate(page, limit);
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: sortMap[sort] || { createdAt: 'desc' },
        skip,
        take,
        include: {
          category: { select: { name: true, slug: true } },
          brand: { select: { name: true, slug: true } },
          images: { take: 2, orderBy: { sortOrder: 'asc' } },
          inventory: { select: { stock: true } },
        },
      }),
    ]);

    return ok({
      products: normalizeProductsMedia(products),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      source: 'database',
    });
  } catch (error) {
    if (error instanceof z.ZodError) return badRequest('Parámetros inválidos');
    return serverError(error);
  }
}
