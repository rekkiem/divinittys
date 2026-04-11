/**
 * src/instrumentation.ts
 * Next.js instrumentation hook — runs once at server startup.
 * Used to initialize BullMQ workers and Meilisearch index.
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the server (not Edge runtime)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { env } = await import('@/lib/env');

  // ── Meilisearch index setup (non-blocking) ─────────────────────
  try {
    const { setupMeiliIndex } = await import('@/lib/search/meilisearch');
    await setupMeiliIndex();
  } catch {
    // Meilisearch not available — search will fall back to SQL
    console.warn('[instrumentation] Meilisearch not available, using SQL fallback');
  }

  // ── BullMQ workers (only when Redis is configured) ─────────────
  if (env.REDIS_URL) {
    try {
      const { startSearchWorker } = await import('@/lib/queue/search.queue');
      startSearchWorker();
      console.log('[instrumentation] Search worker started');
    } catch {
      console.warn('[instrumentation] Redis not available, queue workers disabled');
    }
  }
}
