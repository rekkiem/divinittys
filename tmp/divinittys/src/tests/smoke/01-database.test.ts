/**
 * Smoke Test 1: Conexión a Base de Datos
 * Usa el mock de prisma configurado en setup.ts
 * Para tests contra DB real, usar: DATABASE_URL=... npm run test:smoke
 */
import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('Database Connection', () => {
  it('should connect to PostgreSQL (mocked)', async () => {
    const result = await prisma.$queryRaw`SELECT 1`;
    expect(result).toBeTruthy();
  });

  it('should have products table accessible', async () => {
    const count = await prisma.product.count();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should have categories table accessible', async () => {
    const count = await prisma.category.count();
    expect(typeof count).toBe('number');
  });

  it('should have users table accessible', async () => {
    const count = await prisma.user.count();
    expect(typeof count).toBe('number');
  });

  it('should find admin user (seeded)', async () => {
    const admin = await prisma.user.findFirst({
      where: { email: 'admin@divinittys.cl' },
    });
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe('SUPER_ADMIN');
  });

  it('should have seed categories', async () => {
    const categories = await prisma.category.findMany({ take: 1 });
    expect(categories.length).toBeGreaterThan(0);
  });
});
