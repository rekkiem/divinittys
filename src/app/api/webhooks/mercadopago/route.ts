/**
 * POST /api/webhooks/mercadopago
 * Notificaciones IPN/Webhook de MercadoPago (body JSON).
 *
 * Configurar en el panel de MP:
 *   URL: https://TU_DOMINIO/api/webhooks/mercadopago
 *   Eventos: payments
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { markPaymentFailed, markPaymentPaid } from '@/lib/payments/payment-helpers';
import { verifyMercadoPagoSignature } from '@/lib/payments/mercadopago-webhook';
import { ok, serverError } from '@/lib/utils/api';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const type = body.type || body.topic || body.action;
    const dataId =
      body?.data?.id != null
        ? String(body.data.id)
        : body?.id != null
          ? String(body.id)
          : null;

    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    // Validar firma solo si hay secret configurado
    if (webhookSecret && dataId) {
      const isValid = verifyMercadoPagoSignature(req, dataId, webhookSecret);
      if (!isValid) {
        logger.warn('mp.webhook.invalid_signature', { dataId });
        return NextResponse.json({ error: 'Firma de webhook inválida' }, { status: 401 });
      }
    }

    const isPayment =
      type === 'payment' ||
      type === 'payment.created' ||
      type === 'payment.updated' ||
      String(type || '').includes('payment');

    if (isPayment && dataId && process.env.MERCADOPAGO_ACCESS_TOKEN) {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
      });

      if (!res.ok) {
        logger.warn('mp.webhook.fetch_failed', { dataId, status: res.status });
        return NextResponse.json({ error: 'No se pudo validar el pago en Mercado Pago' }, { status: 502 });
      }

      const mpPayment = await res.json();

      if (mpPayment.external_reference) {
        const payment = await prisma.payment.findFirst({
          where: { order: { orderNumber: String(mpPayment.external_reference) } },
        });

        if (payment && mpPayment.status === 'approved') {
          await markPaymentPaid({
            paymentId: payment.id,
            orderId: payment.orderId,
            responseData: mpPayment,
            externalId: String(mpPayment.id ?? ''),
            paymentMethod: mpPayment.payment_method_id ?? null,
            installments: Number(mpPayment.installments || 1),
          });
        } else if (
          payment &&
          mpPayment.status &&
          ['rejected', 'cancelled', 'refunded'].includes(mpPayment.status)
        ) {
          await markPaymentFailed({
            paymentId: payment.id,
            orderId: payment.orderId,
            reason: `Pago MercadoPago ${mpPayment.status}`,
            responseData: mpPayment,
          });
        }
      }
    }

    return ok({ received: true });
  } catch (err) {
    return serverError(err);
  }
}

// Algunos paneles de MP hacen un GET de verificación
export async function GET() {
  return ok({ status: 'ok', channel: 'mercadopago-webhook' });
}
