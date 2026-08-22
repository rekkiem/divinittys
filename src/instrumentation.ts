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

  // ── Cleanup periódicos de pedidos abandonados ───────────────────
  // Default: cada 15 min. Desactivar con ORDER_CLEANUP_INTERVAL_MS=0
  const cleanupMs = Number(process.env.ORDER_CLEANUP_INTERVAL_MS ?? 15 * 60 * 1000);
  if (cleanupMs > 0) {
    const runCleanup = async () => {
      try {
        const { cancelAbandonedOrders } = await import('@/lib/orders/abandoned-orders');
        const result = await cancelAbandonedOrders();
        if (result.cancelled > 0) {
          logger.info('instrumentation.abandoned_orders_cleanup', result);
        }
      } catch (error) {
        logger.warn('instrumentation.abandoned_orders_cleanup_failed', { error });
      }
    };

    // Primera pasada a los 2 min de arranque, luego cada cleanupMs
    setTimeout(() => {
      runCleanup();
      setInterval(runCleanup, cleanupMs);
    }, 2 * 60 * 1000);

    logger.info('instrumentation.abandoned_orders_scheduler', { intervalMs: cleanupMs });
  }
}
