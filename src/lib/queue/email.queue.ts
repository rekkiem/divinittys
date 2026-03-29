import nodemailer from 'nodemailer';
import { createQueue, createWorker, QueueJob } from './core';
import { logger } from '@/lib/logger';

export const emailQueue = createQueue('email');

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
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

  await transporter().sendMail({ from: process.env.EMAIL_FROM || 'DIVINITTYS <no-reply@divinittys.cl>', to, subject, html });
  logger.info('email.sent', { type, to });
}

export async function queueOrderConfirmationEmail(params: { email: string; orderNumber: string }) {
  try {
    await emailQueue.add(
      'order-confirmed',
      { to: params.email, orderNumber: params.orderNumber },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      }
    );
    logger.info('email.queued', { type: 'order-confirmed', to: params.email, orderNumber: params.orderNumber });
  } catch (error) {
    logger.warn('email.queue_failed', {
      type: 'order-confirmed',
      to: params.email,
      orderNumber: params.orderNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    await sendEmail(
      'order-confirmed',
      params.email,
      `Pedido confirmado ${params.orderNumber}`,
      `<p>Tu pedido ${params.orderNumber} fue confirmado.</p>`
    );
  }
}

export function startEmailWorker() {
  return createWorker('email', async (job: QueueJob) => {
    const email = String(job.data.to || job.data.email || '');
    switch (job.name) {
      case 'welcome':
        return sendEmail('welcome', email, 'Bienvenida a DIVINITTYS', '<h1>¡Bienvenida!</h1><p>Gracias por registrarte.</p>');
      case 'order-confirmed':
        return sendEmail('order-confirmed', email, `Pedido confirmado ${String(job.data.orderNumber || '')}`, `<p>Tu pedido ${String(job.data.orderNumber || '')} fue confirmado.</p>`);
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
