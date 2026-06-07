/**
 * src/instrumentation.ts
 * Next.js instrumentation hook — runs once at server startup.
 * Used to initialize BullMQ workers and Meilisearch index.
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the server (not Edge runtime)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { installGlobalLogCapture, installProcessErrorLogging, logger } = await import('@/lib/logger');
  installGlobalLogCapture();
  installProcessErrorLogging();
  logger.info('system.start', {
    runtime: process.env.NEXT_RUNTIME,
    logDirectory: logger.getLogDirectory(),
  });

  const { env } = await import('@/lib/env');

  // ── Meilisearch index setup (non-blocking) ─────────────────────
  try {
    const { setupMeiliIndex } = await import('@/lib/search/meilisearch');
    await setupMeiliIndex();
  } catch (error) {
    // Meilisearch not available — search will fall back to SQL
    logger.warn('instrumentation.meilisearch_unavailable', { error });
  }

  // ── BullMQ workers (only when Redis is configured) ─────────────
  if (env.REDIS_URL) {
    try {
      const { startSearchWorker } = await import('@/lib/queue/search.queue');
      startSearchWorker();
      logger.info('instrumentation.search_worker_started');
    } catch (error) {
      logger.warn('instrumentation.redis_unavailable', { error });
    }
  }
}
