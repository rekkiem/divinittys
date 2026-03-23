import { describe, it, expect } from 'vitest';

describe('Meilisearch Search Engine', () => {
  it('should return null when URL not configured (mocked)', async () => {
    const { getMeiliClient } = await import('@/lib/search/meilisearch');
    // In test env, meilisearch is mocked to return null
    const client = getMeiliClient();
    expect(client).toBeNull();
  });

  it('should handle graceful fallback to null', async () => {
    const { searchProducts } = await import('@/lib/search/meilisearch');
    const result = await searchProducts({ q: 'test', page: 1, limit: 5 });
    expect(result).toBeNull();
  });

  it('should not throw when indexing product (mocked)', async () => {
    const { indexProduct } = await import('@/lib/search/meilisearch');
    await expect(indexProduct({
      id: 'test', name: 'Test', slug: 'test', description: null,
      sku: 'TST', basePrice: 100, comparePrice: null, isActive: true,
      isFeatured: false, isOnSale: false, category: 'Test', categorySlug: 'test',
      brand: null, brandSlug: null, tags: [], imageUrl: null, stock: 5, createdAt: Date.now(),
    })).resolves.not.toThrow();
  });
});
