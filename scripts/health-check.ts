/**
 * scripts/health-check.ts
 * Health check for all DIVINITTYS services.
 * Works both inside Docker (service names) and on host (localhost).
 *
 * Usage:
 *   docker exec divinittys_app npx tsx scripts/health-check.ts
 *   npm run health    (from host - uses localhost URLs)
 */
import { PrismaClient } from '@prisma/client';

// Detect if running inside Docker (service hostnames available)
const isDocker  = process.env.RUNNING_IN_DOCKER === 'true'
               || process.env.DATABASE_URL?.includes('@postgres:')
               || false;

const DB_URL    = process.env.DATABASE_URL;
const MEILI_URL = process.env.MEILISEARCH_URL || 'http://localhost:7700';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const APP_URL   = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const results: { service: string; ok: boolean; msg: string }[] = [];

async function check(service: string, fn: () => Promise<string>) {
  try {
    const msg = await fn();
    results.push({ service, ok: true, msg });
    console.log(`  ✅ ${service}: ${msg}`);
  } catch (e: any) {
    const msg = e.message?.split('\n')[0] ?? String(e);
    results.push({ service, ok: false, msg });
    console.log(`  ❌ ${service}: ${msg}`);
  }
}

async function checkPostgres() {
  if (!DB_URL) return 'Skipped (DATABASE_URL not set)';
  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'Connected';
  } finally {
    await prisma.$disconnect();
  }
}

async function checkMeilisearch() {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 5000);
  try {
    const res = await fetch(`${MEILI_URL}/health`, { signal: ac.signal });
    const data = await res.json() as { status?: string };
    if (data.status === 'available') return 'OK';
    throw new Error(`status=${data.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function checkRedis() {
  // Use a simple TCP connection test instead of ioredis to avoid unhandled errors
  const url = new URL(REDIS_URL.replace('redis://', 'http://'));
  const host = url.hostname;
  const port = parseInt(url.port || '6379');

  return new Promise<string>((resolve, reject) => {
    const net = require('net');
    const socket = new net.Socket();
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('Connection timeout')); }, 5000);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.write('PING\r\n');
    });

    socket.on('data', (data: Buffer) => {
      if (data.toString().includes('+PONG') || data.toString().includes('PONG')) {
        socket.destroy();
        resolve('PONG received');
      }
    });

    socket.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function checkApp() {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(`${APP_URL}/api/health`, { signal: ac.signal });
    if (res.ok) {
      const data = await res.json() as { status?: string };
      return `HTTP ${res.status} — ${data.status || 'ok'}`;
    }
    throw new Error(`HTTP ${res.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log('\n🔍 DIVINITTYS Health Check');
  console.log(`   Mode: ${isDocker ? 'Docker (internal)' : 'Host (localhost)'}\n`);

  await Promise.all([
    check('PostgreSQL',    checkPostgres),
    check('Meilisearch',   checkMeilisearch),
    check('Redis',         checkRedis),
    check('App Next.js',   checkApp),
  ]);

  const allOk = results.every(r => r.ok);
  const failed = results.filter(r => !r.ok);

  console.log(`\n${allOk ? '✅ All services healthy' : `⚠️  ${failed.length} service(s) unavailable`}`);

  if (!allOk) {
    console.log('\n💡 Troubleshooting:');
    console.log('   Run inside Docker: docker exec divinittys_app npx tsx scripts/health-check.ts');
    console.log('   Full reset: docker compose down -v && docker compose up --build');
  }

  process.exit(allOk ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
