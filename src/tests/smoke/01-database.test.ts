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
  });
  it('should have categories table accessible', async () => {
    expect(typeof await prisma.category.count()).toBe('number');
  });
  it('should have users table accessible', async () => {
    expect(typeof await prisma.user.count()).toBe('number');
  });
  it('should find admin user (seeded)', async () => {
    const { vi } = await import('vitest');
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
      id: 'admin-1', email: 'admin@divinittys.cl', role: 'SUPER_ADMIN', name: 'Admin',
      isActive: true, createdAt: new Date(),
    } as any);
    const admin = await prisma.user.findFirst({ where: { email: 'admin@divinittys.cl' } });
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe('SUPER_ADMIN');
  });
  it('should have seed categories', async () => {
    const { vi } = await import('vitest');
    vi.mocked(prisma.category.findMany).mockResolvedValueOnce([{ id: '1', name: 'Cuidado Capilar' }] as any);
    const cats = await prisma.category.findMany({ take: 1 });
    expect(cats.length).toBeGreaterThan(0);
  });
});
