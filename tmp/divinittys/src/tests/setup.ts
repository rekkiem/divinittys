import { vi } from 'vitest';

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum-aa';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars-min-bb';
process.env.MEILISEARCH_URL = process.env.MEILISEARCH_URL || 'http://localhost:7700';
process.env.MEILISEARCH_API_KEY = 'divinittys_meili_master_key_2024';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock Prisma Client to avoid needing a real DB for unit/auth tests
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]),
    $disconnect: vi.fn(),
    user: {
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi.fn().mockResolvedValue({
        id: 'admin-id', email: 'admin@divinittys.cl', role: 'SUPER_ADMIN',
      }),
    },
    product: { count: vi.fn().mockResolvedValue(5), findMany: vi.fn().mockResolvedValue([]) },
    category: { count: vi.fn().mockResolvedValue(9), findMany: vi.fn().mockResolvedValue([{ id: '1', name: 'Test' }]) },
    order: { count: vi.fn().mockResolvedValue(0) },
  },
}));
