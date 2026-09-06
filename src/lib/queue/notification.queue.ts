import { createQueue, createWorker, QueueJob } from './core';
import { logger } from '@/lib/logger';
import { loadFullOrder, getBuyerName, type FullOrder } from '@/lib/orders/load-full-order';
import { telegramSendMessage, telegramSendDocument, isTelegramConfigured } from '@/lib/notifications/telegram';

export const notificationQueue = createQueue('notification');

function formatCLP(value: number | string | { toString(): string }): string {
  const n = typeof value === 'number' ? value : Number(value);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildVendorMessage(order: FullOrder): string {
  const buyer = getBuyerName(order);
  const email = order.user?.email || order.guestEmail || '—';
  const phone = order.address?.phone || order.guestPhone || order.user?.phone || '—';
  const address = order.address
    ? `${order.address.street} ${order.address.number}${order.address.apartment ? `, ${order.address.apartment}` : ''}\n${order.address.commune}, ${order.address.city}\n${order.address.region}`
    : 'Sin dirección';
  const items = order.items
    .map((i) => `• ${i.name}${i.variant ? ` (${i.variant.name})` : ''} × ${i.quantity} — ${formatCLP(i.total)}`)
    .join('\n');
  const shipment = order.shipment;
  let labelStatus: string;
  if (shipment?.labelUrl) {
    labelStatus = `✅ Etiqueta generada\nTracking: ${shipment.trackingNumber || '—'}\n${shipment.labelUrl}`;
  } else if (shipment?.status === 'READY_TO_SHIP') {
    labelStatus = '⚠️ Etiqueta pendiente — generar manualmente en panel Blue Express (ecommerce.blue.cl)';
  } else {
    labelStatus = '⏳ Envío aún no procesado';
  }
  return (
    `<b>🛒 Nuevo pedido confirmado</b>\n` +
    `<b>#${escapeHtml(order.orderNumber)}</b>\n\n` +
    `<b>Cliente:</b> ${escapeHtml(buyer)}\n` +
    `<b>Email:</b> ${escapeHtml(email)}\n` +
    `<b>Tel:</b> ${escapeHtml(phone)}\n\n` +
    `<b>Dirección:</b>\n${escapeHtml(address)}\n\n` +
    `<b>Items:</b>\n${escapeHtml(items)}\n\n` +
    `<b>Total:</b> ${formatCLP(order.total)}\n` +
    `<b>Pago:</b> ${escapeHtml(String(order.payment?.provider || '—'))}\n\n` +
    `<b>Envío / etiqueta:</b>\n${labelStatus}`
  );
}

export async function enqueueVendorAlert(orderId: string) {
  await notificationQueue.add(
    'vendor-alert',
    { orderId },
    {
      jobId: `vendor-alert-${orderId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
  logger.info('notification.vendor_alert_queued', { orderId });
}

async function processVendorAlert(orderId: string) {
  if (!isTelegramConfigured()) {
    logger.warn('notification.telegram_not_configured', { orderId });
    return;
  }
  const order = await loadFullOrder(orderId);
  const text = buildVendorMessage(order);
  await telegramSendMessage(text);
  if (order.shipment?.labelUrl) {
    await telegramSendDocument(order.shipment.labelUrl, `Etiqueta ${order.orderNumber}`);
  }
}

export function startNotificationWorker() {
  return createWorker('notification', async (job: QueueJob) => {
    if (job.name !== 'vendor-alert') {
      logger.warn('notification.unknown_job', { name: job.name });
      return;
    }
    const orderId = String(job.data.orderId || '');
    if (!orderId) throw new Error('vendor-alert missing orderId');
    return processVendorAlert(orderId);
  });
}
