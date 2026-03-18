/**
 * Meilisearch client — búsqueda full-text para productos
 * Fallback graceful: si Meilisearch no está disponible, no rompe la app
 */
import { MeiliSearch } from 'meilisearch';

let _client: MeiliSearch | null = null;

export function getMeiliClient(): MeiliSearch | null {
  const url = process.env.MEILISEARCH_URL;
  const apiKey = process.env.MEILISEARCH_API_KEY;
  if (!url) return null;
  if (!_client) {
    _client = new MeiliSearch({ host: url, apiKey: apiKey || undefined });
  }
  return _client;
}

export const PRODUCTS_INDEX = 'products';

export type MeiliProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  basePrice: number;
  comparePrice: number | null;
  isActive: boolean;
  isFeatured: boolean;
  isOnSale: boolean;
  category: string | null;
  categorySlug: string | null;
  brand: string | null;
  brandSlug: string | null;
  tags: string[];
  imageUrl: string | null;
  stock: number;
  createdAt: number;
};

export async function setupMeiliIndex(): Promise<void> {
  const client = getMeiliClient();
  if (!client) return;
  try {
    const index = client.index(PRODUCTS_INDEX);
    await index.updateSettings({
      searchableAttributes: ['name', 'description', 'sku', 'category', 'brand', 'tags'],
      filterableAttributes: ['category', 'categorySlug', 'brand', 'brandSlug', 'isActive', 'isFeatured', 'isOnSale', 'basePrice', 'stock'],
      sortableAttributes: ['basePrice', 'createdAt', 'name'],
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
      typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
    });
  } catch (e) {
    console.warn('[Meilisearch] setup failed:', e);
  }
}

export async function indexProduct(product: MeiliProduct): Promise<void> {
  const client = getMeiliClient();
  if (!client) return;
  try {
    await client.index(PRODUCTS_INDEX).addDocuments([product]);
  } catch (e) {
    console.warn('[Meilisearch] indexProduct failed:', e);
  }
}

export async function deleteProductFromIndex(id: string): Promise<void> {
  const client = getMeiliClient();
  if (!client) return;
  try {
    await client.index(PRODUCTS_INDEX).deleteDocument(id);
  } catch (e) {
    console.warn('[Meilisearch] deleteProduct failed:', e);
  }
}

export type SearchProductsParams = {
  q: string;
  page?: number;
  limit?: number;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'name_asc';
};

export async function searchProducts(params: SearchProductsParams): Promise<{
  hits: MeiliProduct[];
  total: number;
  facets: { categories: Record<string, number>; brands: Record<string, number> };
} | null> {
  const client = getMeiliClient();
  if (!client) return null;

  const { q, page = 1, limit = 20, category, brand, minPrice, maxPrice, onSale, sort } = params;
  const filters: string[] = ['isActive = true'];
  if (category) filters.push(`categorySlug = "${category}"`);
  if (brand) filters.push(`brandSlug = "${brand}"`);
  if (minPrice !== undefined) filters.push(`basePrice >= ${minPrice}`);
  if (maxPrice !== undefined) filters.push(`basePrice <= ${maxPrice}`);
  if (onSale) filters.push('isOnSale = true');

  const sortMap: Record<string, string> = {
    price_asc: 'basePrice:asc', price_desc: 'basePrice:desc',
    newest: 'createdAt:desc', name_asc: 'name:asc',
  };

  try {
    const result = await client.index(PRODUCTS_INDEX).search(q, {
      page, hitsPerPage: limit,
      filter: filters.join(' AND '),
      sort: sort ? [sortMap[sort]] : ['createdAt:desc'],
      facets: ['category', 'brand'],
    });
    return {
      hits: result.hits as MeiliProduct[],
      total: result.totalHits ?? 0,
      facets: {
        categories: (result.facetDistribution?.['category'] ?? {}) as Record<string, number>,
        brands: (result.facetDistribution?.['brand'] ?? {}) as Record<string, number>,
      },
    };
  } catch (e) {
    console.warn('[Meilisearch] search failed, falling back to SQL:', e);
    return null;
  }
}

export async function reindexAll(products: MeiliProduct[]): Promise<void> {
  const client = getMeiliClient();
  if (!client) return;
  try {
    await setupMeiliIndex();
    const batchSize = 500;
    for (let i = 0; i < products.length; i += batchSize) {
      await client.index(PRODUCTS_INDEX).addDocuments(products.slice(i, i + batchSize));
      console.log(`[Meilisearch] indexed ${Math.min(i + batchSize, products.length)}/${products.length}`);
    }
    console.log('[Meilisearch] reindex complete');
  } catch (e) {
    console.error('[Meilisearch] reindexAll failed:', e);
  }
}
