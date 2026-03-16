/**
 * GET /api/health
 * Health check endpoint — usado por Docker, Railway, Render, etc.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {};

  // Check DB
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // Check Meilisearch
  const meiliUrl = process.env.MEILISEARCH_URL;
  if (meiliUrl) {
    try {
      const res = await fetch(`${meiliUrl}/health`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json() as { status?: string };
      checks.meilisearch = data.status === 'available' ? 'ok' : 'error';
    } catch {
      checks.meilisearch = 'error';
    }
  }

  const allOk = Object.values(checks).every(v => v === 'ok');
  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
