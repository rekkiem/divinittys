import nodemailer from 'nodemailer';
import { createQueue, createWorker, QueueJob } from './core';
import { logger } from '@/lib/logger';
import {
  buildOrderConfirmedHtml,
  buildOrderConfirmedSubject,
} from '@/lib/email/templates/order-confirmed';
import type { FullOrder } from '@/lib/orders/load-full-order';
import { getBuyerEmail } from '@/lib/orders/load-full-order';

export const emailQueue = createQueue('email');

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

async function sendEmail(type: string, to: string, subject: string, html: string) {
  if (!process.env.SMTP_HOST) {
    logger.warn('email.skipped', { type, to, reason: 'smtp_missing' });
    return;
  }
  await transporter().sendMail({
    from: process.env.EMAIL_FROM || 'DIVINITTYS <no-reply@divinittys.cl>',
    to,
    subject,
    html,
  });
  logger.info('email.sent', { type, to });
}

export async function queueOrderConfirmationEmail(
  params: { order: FullOrder } | { email: string; orderNumber: string }
) {
  let to: string;
  let orderNumber: string;
  let html: string;
  let subject: string;

  if ('order' in params) {
    const email = getBuyerEmail(params.order);
    if (!email) {
      logger.warn('email.order_confirmed_no_email', { orderId: params.order.id });
      return;
    }
    to = email;
    orderNumber = params.order.orderNumber;
    subject = buildOrderConfirmedSubject(orderNumber);
    html = buildOrderConfirmedHtml(params.order);
  } else {
    to = params.email;
    orderNumber = params.orderNumber;
    subject = `Pedido confirmado ${orderNumber}`;
    html = `<p>Tu pedido ${orderNumber} fue confirmado.</p>`;
  }

  try {
    await emailQueue.add(
      'order-confirmed',
      { to, orderNumber, html, subject },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      }
    );
    logger.info('email.queued', { type: 'order-confirmed', to, orderNumber });
  } catch (error) {
    logger.warn('email.queue_failed', {
      type: 'order-confirmed',
      to,
      orderNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    await sendEmail('order-confirmed', to, subject, html);
  }
}

export function startEmailWorker() {
  return createWorker('email', async (job: QueueJob) => {
    const email = String(job.data.to || job.data.email || '');
    switch (job.name) {
      case 'welcome':
        return sendEmail('welcome', email, 'Bienvenida a DIVINITTYS', '<h1>¡Bienvenida!</h1><p>Gracias por registrarte.</p>');
      case 'order-confirmed': {
        const subject = String(job.data.subject || '') || `Pedido confirmado ${String(job.data.orderNumber || '')}`;
        const html = String(job.data.html || '') || `<p>Tu pedido ${String(job.data.orderNumber || '')} fue confirmado.</p>`;
        return sendEmail('order-confirmed', email, subject, html);
      }
      case 'shipping-update':
        return sendEmail('shipping-update', email, 'Actualización de envío', `<p>Estado: ${String(job.data.status || '')}</p>`);
      case 'abandoned-cart':
        return sendEmail('abandoned-cart', email, 'Tu carrito te está esperando', '<p>Completa tu compra y recibe tus productos favoritos.</p>');
      default:
        logger.warn('email.unknown_job', { name: job.name });
        return;
    }
  });
}
