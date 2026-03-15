import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { createQueue, createWorker, QueueJob } from './core';

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
    await prisma.emailLog.create({ data: { type, recipientEmail: to, status: 'SKIPPED', metadata: { reason: 'smtp_missing' } } });
    return;
  }

  await transporter().sendMail({ from: process.env.EMAIL_FROM || 'DIVINITTYS <no-reply@divinittys.cl>', to, subject, html });
  await prisma.emailLog.create({ data: { type, recipientEmail: to, status: 'SENT', sentAt: new Date() } });
}

export function startEmailWorker() {
  return createWorker('email', async (job: QueueJob) => {
    const email = String(job.data.email || '');
    switch (job.name) {
      case 'welcome':
        return sendEmail('welcome', email, 'Bienvenida a DIVINITTYS', '<h1>¡Bienvenida!</h1><p>Gracias por registrarte.</p>');
      case 'order-confirmed':
        return sendEmail('order-confirmed', email, `Pedido confirmado ${String(job.data.orderNumber || '')}`, `<p>Tu pedido ${String(job.data.orderNumber || '')} fue confirmado.</p>`);
      case 'shipping-update':
        return sendEmail('shipping-update', email, 'Actualización de envío', `<p>Estado: ${String(job.data.status || '')}</p>`);
      case 'abandoned-cart':
        return sendEmail('abandoned-cart', email, 'Tu carrito te está esperando', '<p>Completa tu compra y recibe tus productos favoritos.</p>');
    }
  });
}
