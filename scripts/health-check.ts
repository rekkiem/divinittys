/**
 * scripts/health-check.ts
 * Valida la disponibilidad de todos los servicios
 * Uso: npx tsx scripts/health-check.ts
 */
import { PrismaClient } from '@prisma/client';

async function checkPostgres(): Promise<boolean> {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('  ✅ PostgreSQL: OK');
    return true;
  } catch (e) {
    console.log('  ❌ PostgreSQL:', e instanceof Error ? e.message : e);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function checkMeilisearch(): Promise<boolean> {
  const url = process.env.MEILISEARCH_URL || 'http://localhost:7700';
  try {
    const res = await fetch(`${url}/health`);
    const data = await res.json() as { status?: string };
    if (data.status === 'available') {
      console.log('  ✅ Meilisearch: OK');
      return true;
    }
    console.log('  ❌ Meilisearch: status =', data.status);
    return false;
  } catch (e) {
    console.log('  ❌ Meilisearch:', e instanceof Error ? e.message : e);
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    const { createClient } = await import('redis') as any;
    const client = createClient({ url });
    await client.connect();
    await client.ping();
    await client.disconnect();
    console.log('  ✅ Redis: OK');
    return true;
  } catch {
    // ioredis fallback
    try {
      const { default: Redis } = await import('ioredis') as any;
      const redis = new Redis(url);
      await redis.ping();
      redis.disconnect();
      console.log('  ✅ Redis: OK');
      return true;
    } catch (e) {
      console.log('  ❌ Redis:', e instanceof Error ? e.message : e);
      return false;
    }
  }
}

async function checkApp(): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${appUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      console.log('  ✅ App Next.js: OK');
      return true;
    }
    console.log('  ❌ App Next.js: HTTP', res.status);
    return false;
  } catch (e) {
    console.log('  ❌ App Next.js:', e instanceof Error ? e.message : 'not reachable');
    return false;
  }
}

async function main() {
  console.log('\n🔍 DIVINITTYS Health Check\n');
  const results = await Promise.all([
    checkPostgres(),
    checkMeilisearch(),
    checkRedis(),
    checkApp(),
  ]);

  const allOk = results.every(Boolean);
  console.log(`\n${allOk ? '✅ All services healthy' : '⚠️  Some services have issues'}`);
  process.exit(allOk ? 0 : 1);
}

main();
