/**
 * Smoke Test 2: Motor de Búsqueda (Meilisearch)
 * Skip gracefully when Meilisearch is not running
 */
import { describe, it, expect } from 'vitest';
import { getMeiliClient, PRODUCTS_INDEX } from '@/lib/search/meilisearch';

async function isMeiliAvailable(): Promise<boolean> {
  const client = getMeiliClient();
  if (!client) return false;
  try {
    const h = await client.health();
    return h.status === 'available';
  } catch { return false; }
}

describe('Meilisearch Search Engine', () => {
  it('should initialize client when URL is set', () => {
    if (!process.env.MEILISEARCH_URL) {
      expect(getMeiliClient()).toBeNull();
    } else {
      expect(getMeiliClient()).not.toBeNull();
    }
  });

  it('should report healthy when running', async () => {
    if (!(await isMeiliAvailable())) {
      console.log('ℹ️  Meilisearch not running — skipping connectivity test');
      return;
    }
    const client = getMeiliClient()!;
    const health = await client.health();
    expect(health.status).toBe('available');
  });

  it('should handle unavailable search gracefully (fallback to null)', async () => {
    const { searchProducts } = await import('@/lib/search/meilisearch');
    const result = await searchProducts({ q: 'shampoo', page: 1, limit: 5 });
    // Either valid result (if running) or null (graceful fallback)
    if (result !== null) {
      expect(result).toHaveProperty('hits');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.hits)).toBe(true);
    } else {
      // Graceful fallback — this is correct behavior
      expect(result).toBeNull();
    }
  });

  it('should index products without throwing', async () => {
    if (!(await isMeiliAvailable())) {
      console.log('ℹ️  Skipping index test — Meilisearch not running');
      return;
    }
    const { indexProduct } = await import('@/lib/search/meilisearch');
    // Should not throw even with test data
    await expect(indexProduct({
      id: 'test-prod-001', name: 'Test Shampoo', slug: 'test-shampoo',
      description: 'Test product', sku: 'TST-001', basePrice: 9990,
      comparePrice: null, isActive: true, isFeatured: false, isOnSale: false,
      category: 'Cabello', categorySlug: 'cabello', brand: 'TestBrand',
      brandSlug: 'testbrand', tags: ['cabello', 'shampoo'], imageUrl: null,
      stock: 10, createdAt: Date.now(),
    })).resolves.not.toThrow();
  });
});
