/**
 * GET /api/health
 * Health check endpoint — usado por Docker, Railway, Render, CI/CD.
 *
 * HTTP 200 = healthy OR degraded-but-serving (app is up, some optional services down)
 * HTTP 503 = critical failure (database unavailable — app cannot serve requests)
 *
 * Criticality:
 *   database    → CRITICAL  (503 if down — nothing works without DB)
 *   meilisearch → OPTIONAL  (200 even if down — search falls back to SQL)
 *   redis       → OPTIONAL  (200 even if down — queues degrade gracefully)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type CheckStatus = 'ok' | 'error' | 'skipped';

export async function GET() {
  const checks: Record<string, CheckStatus> = {};

  // ── Database (CRITICAL) ───────────────────────────────────────────
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // ── Meilisearch (OPTIONAL — has SQL fallback) ─────────────────────
  const meiliUrl = process.env.MEILISEARCH_URL;
  if (meiliUrl) {
    try {
      const res  = await fetch(`${meiliUrl}/health`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json() as { status?: string };
      checks.meilisearch = data.status === 'available' ? 'ok' : 'error';
    } catch {
      checks.meilisearch = 'error';
    }
  } else {
    checks.meilisearch = 'skipped';
  }

  // ── Redis (OPTIONAL — queues degrade gracefully without it) ────────
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const { hostname, port } = new URL(redisUrl.replace('redis://', 'http://'));
      await new Promise<void>((resolve, reject) => {
        const net = require('net');
        const socket = new net.Socket();
        const timer = setTimeout(() => { socket.destroy(); reject(new Error('timeout')); }, 2000);
        socket.connect(parseInt(port || '6379'), hostname, () => { clearTimeout(timer); socket.destroy(); resolve(); });
        socket.on('error', (e: Error) => { clearTimeout(timer); reject(e); });
      });
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }
  } else {
    checks.redis = 'skipped';
  }

  // ── Status decision ───────────────────────────────────────────────
  // Only DATABASE failure makes the app truly unavailable → 503
  const dbOk      = checks.database === 'ok';
  const allOk     = Object.values(checks).every(v => v === 'ok' || v === 'skipped');
  const status    = allOk ? 'healthy' : dbOk ? 'degraded' : 'unhealthy';
  const httpCode  = dbOk ? 200 : 503;

  return NextResponse.json(
    { status, checks, timestamp: new Date().toISOString() },
    { status: httpCode }
  );
}
