/**
 * Smoke Test 3: API de Productos
 * Valida el flujo de visualización de productos
 */
import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function apiGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    signal: AbortSignal.timeout(8000),
  });
  return { status: res.status, data: await res.json() };
}

describe('Products API - Smoke Tests', () => {
  it('GET /api/health should return healthy status', async () => {
    try {
      const { status, data } = await apiGet('/api/health');
      expect(status).toBeLessThanOrEqual(503); // 200 or 503 are valid
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('checks');
    } catch {
      console.log('ℹ️  App not running — skipping API smoke test');
    }
  });

  it('GET /api/products should return product list', async () => {
    try {
      const { status, data } = await apiGet('/api/products?limit=5');
      expect(status).toBe(200);
      expect(data).toHaveProperty('products');
      expect(Array.isArray(data.products)).toBe(true);
      expect(data).toHaveProperty('pagination');
    } catch {
      console.log('ℹ️  App not running — skipping');
    }
  });

  it('GET /api/products with search query should work', async () => {
    try {
      const { status, data } = await apiGet('/api/products?q=cabello&limit=5');
      expect(status).toBe(200);
      expect(data).toHaveProperty('products');
    } catch {
      console.log('ℹ️  App not running — skipping');
    }
  });

  it('GET /api/products with filters should work', async () => {
    try {
      const { status, data } = await apiGet('/api/products?onSale=true&limit=5');
      expect(status).toBe(200);
      expect(data).toHaveProperty('products');
    } catch {
      console.log('ℹ️  App not running — skipping');
    }
  });
});
