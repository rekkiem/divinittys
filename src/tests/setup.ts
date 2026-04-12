/**
 * Global Vitest setup
 * Mocks Prisma to avoid needing a real DB in unit/integration tests
 */
import { vi, beforeEach } from 'vitest';

// ── Environment ───────────────────────────────────────────
process.env.DATABASE_URL      = 'postgresql://test:test@localhost:5432/test_divinittys';
process.env.JWT_SECRET        = 'test-jwt-secret-minimum-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-chars!!';
process.env.MEILISEARCH_URL   = 'http://localhost:7700';
process.env.MEILISEARCH_API_KEY = 'test-meili-key';
process.env.REDIS_URL         = 'redis://localhost:6379';


// ── Prisma Mock ───────────────────────────────────────────
// Default: returns sensible values; override per-test with vi.mocked(prisma.xxx).mockResolvedValue(...)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw:    vi.fn().mockResolvedValue([{ result: 1 }]),
    $transaction: vi.fn().mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') return fn(mockTx);
      return Promise.all(fn);
    }),
    $disconnect:  vi.fn(),
    user: {
      findFirst:  vi.fn(),
      findUnique: vi.fn(),
      findMany:   vi.fn().mockResolvedValue([]),
      create:     vi.fn(),
      update:     vi.fn(),
      updateMany: vi.fn(),
      count:      vi.fn().mockResolvedValue(0),
      upsert:     vi.fn(),
    },
    product: {
      findFirst:  vi.fn(),
      findUnique: vi.fn(),
      findMany:   vi.fn().mockResolvedValue([]),
      create:     vi.fn(),
      update:     vi.fn(),
      delete:     vi.fn(),
      count:      vi.fn().mockResolvedValue(0),
    },
    category: {
      findFirst:  vi.fn(),
      findMany:   vi.fn().mockResolvedValue([]),
      create:     vi.fn(),
      update:     vi.fn(),
      count:      vi.fn().mockResolvedValue(0),
      upsert:     vi.fn(),
    },
    brand: {
      findMany:   vi.fn().mockResolvedValue([]),
      create:     vi.fn(),
      upsert:     vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      findMany:   vi.fn().mockResolvedValue([]),
      update:     vi.fn(),
      count:      vi.fn().mockResolvedValue(0),
      aggregate:  vi.fn().mockResolvedValue({ _sum: { total: 0 } }),
    },
    inventory: {
      findMany:   vi.fn().mockResolvedValue([]),
      create:     vi.fn(),
      upsert:     vi.fn(),
      updateMany: vi.fn(),
    },
    productVariant: {
      update:     vi.fn(),
      updateMany: vi.fn(),
    },
    setting: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert:   vi.fn(),
      update:   vi.fn(),
      create:   vi.fn(),
    },
    payment: {
      findFirst:  vi.fn(),
      findUnique: vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
      updateMany: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    productImage: {
      count:      vi.fn().mockResolvedValue(0),
      create:     vi.fn(),
      updateMany: vi.fn(),
    },
    review: {
      aggregate:  vi.fn().mockResolvedValue({ _avg: { rating: 0 }, _count: { rating: 0 } }),
    },

  },
}));

// Mock transaction context (used in $transaction callback)
const mockTx = {
  product:   { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  inventory: { create: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  productVariant: { update: vi.fn(), updateMany: vi.fn() },
  payment:   { findUnique: vi.fn(), update: vi.fn() },
  order:     { update: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  orderItem: { findMany: vi.fn().mockResolvedValue([]) },
};

// ── Meilisearch Mock ──────────────────────────────────────
vi.mock('@/lib/search/meilisearch', () => ({
  getMeiliClient:      vi.fn().mockReturnValue(null),
  searchProducts:      vi.fn().mockResolvedValue(null),
  indexProduct:        vi.fn().mockResolvedValue(undefined),
  deleteProductFromIndex: vi.fn().mockResolvedValue(undefined),
  reindexAll:          vi.fn().mockResolvedValue(undefined),
  setupMeiliIndex:     vi.fn().mockResolvedValue(undefined),
  PRODUCTS_INDEX:      'products',
}));

// ── Queue Mock ────────────────────────────────────────────
vi.mock('@/lib/queue/queues', () => ({
  enqueueSearchIndex: vi.fn().mockResolvedValue(undefined),
  enqueueEmail:       vi.fn().mockResolvedValue(undefined),
  getEmailQueue:      vi.fn(),
  getSearchQueue:     vi.fn(),
  QUEUE_NAMES:        { EMAIL: 'email', SEARCH_INDEX: 'search' },
}));

// ── Reset mocks between tests ──────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});
