/**
 * Orquestador post-pago: email + shipping.
 * Telegram lo dispara shipping.queue al terminar (sin race condition).
 */
import { createQueue, createWorker, QueueJob } from './core';
import { logger } from '@/lib/logger';
import { loadFullOrder } from '@/lib/orders/load-full-order';
import { queueOrderConfirmationEmail } from './email.queue';
import { enqueueCreateShipment } from './shipping.queue';

export const fulfillmentQueue = createQueue('fulfillment');

export async function enqueueOrderFulfilled(orderId: string): Promise<void> {
  try {
    await fulfillmentQueue.add(
      'order-fulfilled',
      { orderId },
      {
        jobId: `fulfill-${orderId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 4000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      }
    );
    logger.info('fulfillment.queued', { orderId });
  } catch (e) {
    logger.error('fulfillment.enqueue_failed', {
      orderId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export function startFulfillmentWorker() {
  return createWorker('fulfillment', async (job: QueueJob) => {
    if (job.name !== 'order-fulfilled') {
      logger.warn('fulfillment.unknown_job', { name: job.name });
      return;
    }
    const orderId = String(job.data.orderId || '');
    if (!orderId) throw new Error('order-fulfilled missing orderId');

    const order = await loadFullOrder(orderId);

    const results = await Promise.allSettled([
      queueOrderConfirmationEmail({ order }),
      enqueueCreateShipment(orderId),
    ]);

    const labels = ['email', 'shipping'] as const;
    const failed: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        failed.push(labels[i]);
        logger.error('fulfillment.step_failed', {
          orderId,
          step: labels[i],
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      } else {
        logger.info('fulfillment.step_ok', { orderId, step: labels[i] });
      }
    });

    if (failed.length > 0) {
      throw new Error(`fulfillment steps failed: ${failed.join(', ')} (orderId=${orderId})`);
    }

    return { orderId, email: results[0].status, shipping: results[1].status };
  });
}
