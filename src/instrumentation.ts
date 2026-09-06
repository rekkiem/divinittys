/**
 * src/instrumentation.ts
 * Next.js instrumentation hook — runs once at server startup.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { installGlobalLogCapture, installProcessErrorLogging, logger } = await import('@/lib/logger');
  installGlobalLogCapture();
  installProcessErrorLogging();
  logger.info('system.start', {
    runtime: process.env.NEXT_RUNTIME,
    logDirectory: logger.getLogDirectory(),
  });

  const { env } = await import('@/lib/env');

  try {
    const { setupMeiliIndex } = await import('@/lib/search/meilisearch');
    await setupMeiliIndex();
  } catch (error) {
    logger.warn('instrumentation.meilisearch_unavailable', { error });
  }

  if (env.REDIS_URL) {
    try {
      const { startSearchWorker } = await import('@/lib/queue/search.queue');
      const { startEmailWorker } = await import('@/lib/queue/email.queue');
      const { startNotificationWorker } = await import('@/lib/queue/notification.queue');
      const { startShippingWorker } = await import('@/lib/queue/shipping.queue');
      const { startFulfillmentWorker } = await import('@/lib/queue/fulfillment.queue');

      startSearchWorker();
      startEmailWorker();
      startNotificationWorker();
      startShippingWorker();
      startFulfillmentWorker();

      logger.info('instrumentation.workers_started', {
        workers: ['search', 'email', 'notification', 'shipping', 'fulfillment'],
      });
    } catch (error) {
      logger.warn('instrumentation.redis_unavailable', { error });
    }
  }

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

    setTimeout(() => {
      runCleanup();
      setInterval(runCleanup, cleanupMs);
    }, 2 * 60 * 1000);

    logger.info('instrumentation.abandoned_orders_scheduler', { intervalMs: cleanupMs });
  }
}
