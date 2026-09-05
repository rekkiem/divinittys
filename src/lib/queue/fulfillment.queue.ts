/**
 * Orquestador post-pago: email comprador + shipping + alerta vendedor.
 * Un solo job idempotente por orderId (jobId: fulfill-${orderId}).
 */
import { createQueue, createWorker, QueueJob } from './core';
import { logger } from '@/lib/logger';
import { loadFullOrder } from '@/lib/orders/load-full-order';
import { queueOrderConfirmationEmail } from './email.queue';
import { enqueueCreateShipment } from './shipping.queue';
import { enqueueVendorAlert } from './notification.queue';

export const fulfillmentQueue = createQueue('fulfillment');

/**
 * Encola el job de fulfillment. Idempotente vía jobId.
 * Llamar fuera de la transacción de markPaymentPaid.
 */
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
    // Si Redis está caído no debe romper el flujo de pago
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

    // Promise.allSettled: un fallo no bloquea a los demás
    const results = await Promise.allSettled([
      queueOrderConfirmationEmail({ order }),
      enqueueCreateShipment(orderId),
      enqueueVendorAlert(orderId),
    ]);

    const labels = ['email', 'shipping', 'notification'] as const;
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        logger.error('fulfillment.step_failed', {
          orderId,
          step: labels[i],
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      } else {
        logger.info('fulfillment.step_ok', { orderId, step: labels[i] });
      }
    });

    return {
      orderId,
      email: results[0].status,
      shipping: results[1].status,
      notification: results[2].status,
    };
  });
}
