/**
 * /api/payments — Payment gateway integration
 * Supports: Transbank Webpay Plus + MercadoPago
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createWebpayTransaction, commitWebpayTransaction, normalizeBuyOrder } from '@/lib/payments/webpay';
import { createMPPreference } from '@/lib/payments/mercadopago';
import { ok, badRequest, notFound, serverError } from '@/lib/utils/api';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { markPaymentFailed, markPaymentPaid } from '@/lib/payments/payment-helpers';
import { getMercadoPagoMode, verifyMercadoPagoSignature } from '@/lib/payments/mercadopago-webhook';
import { queueOrderConfirmationEmail } from '@/lib/queue/email.queue';

const APP_URL = env.NEXT_PUBLIC_APP_URL;

async function findOrderAndValidate(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payment: true,
      items: { include: { product: { include: { images: { where: { isMain: true }, take: 1 } } } } },
      user: { select: { email: true } },
    },
  });

  if (!order) throw Object.assign(new Error('Pedido no encontrado'), { code: 404 });
  if (order.payment?.status === 'PAID') throw Object.assign(new Error('Este pedido ya fue pagado'), { code: 400 });
  return order;
}

async function ensurePaymentRecord(orderId: string, provider: string, total: number) {
  const existing = await prisma.payment.findFirst({ where: { orderId } });
  if (existing) {
    return prisma.payment.update({
      where: { id: existing.id },
      data: { provider: provider as any, status: 'PROCESSING', amount: total },
    });
  }

  return prisma.payment.create({
    data: { orderId, provider: provider as any, status: 'PROCESSING', amount: total, currency: 'CLP' },
  });
}

async function queueOrderConfirmation(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      guestEmail: true,
      user: { select: { email: true } },
    },
  });

  const email = order?.guestEmail || order?.user?.email;
  if (!order || !email) return;

  await queueOrderConfirmationEmail({
    email,
    orderNumber: order.orderNumber,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('webhook') === 'mp') {
      return handleMercadoPagoWebhook(req);
    }

    const body = await req.json().catch(() => ({}));

    let action = searchParams.get('action');
    if (!action) {
      const provider = String(body.provider || '').toUpperCase();
      action = provider === 'MERCADOPAGO' ? 'mp-preference' : 'webpay-init';
    }

    if (action === 'webpay-init') {
      const { orderId } = z.object({ orderId: z.string() }).parse(body);
      const order = await findOrderAndValidate(orderId);
      const total = Number(order.total);
      const buyOrder = normalizeBuyOrder(order.orderNumber);

      const tbk = await createWebpayTransaction({
        buyOrder,
        sessionId: `${orderId.slice(0, 8)}-${Date.now()}`,
        amount: total,
        returnUrl: `${APP_URL}/checkout/webpay-return`,
      });

      await ensurePaymentRecord(orderId, 'WEBPAY', total);
      await prisma.payment.update({
        where: { orderId },
        data: { token: tbk.token, status: 'PROCESSING' },
      });

      logger.info('webpay.init', { orderId, buyOrder, token: tbk.token });
      return ok({ token: tbk.token, url: tbk.url });
    }

    if (action === 'webpay-commit') {
      const parsed = z.object({
        token_ws: z.string().optional(),
        TBK_TOKEN: z.string().optional(),
        TBK_ORDEN_COMPRA: z.string().optional(),
      }).parse(body);

      if (parsed.TBK_TOKEN) {
        const payment = await prisma.payment.findFirst({
          where: {
            OR: [
              { token: parsed.TBK_TOKEN },
              parsed.TBK_ORDEN_COMPRA ? { order: { orderNumber: parsed.TBK_ORDEN_COMPRA } } : undefined,
            ].filter(Boolean) as any,
          },
          include: { order: true },
        });

        if (payment) {
          await markPaymentFailed({
            paymentId: payment.id,
            orderId: payment.orderId,
            reason: 'webpay_timeout_or_abort',
            responseData: { tbkToken: parsed.TBK_TOKEN, buyOrder: parsed.TBK_ORDEN_COMPRA ?? null },
          });
        }

        return ok({ success: false, message: 'Transacción cancelada o expirada en Webpay' });
      }

      const tokenWs = parsed.token_ws;
      if (!tokenWs) return badRequest('token_ws es requerido');

      const payment = await prisma.payment.findFirst({
        where: { token: tokenWs },
        include: { order: true },
      });
      if (!payment) return notFound('Pago no encontrado');

      if (payment.status === 'PAID') {
        logger.info('webpay.commit_idempotent', { paymentId: payment.id, orderId: payment.orderId, token: tokenWs });
        return ok({ success: true, orderNumber: payment.order.orderNumber, alreadyProcessed: true });
      }

      let result: Record<string, unknown>;
      try {
        result = await commitWebpayTransaction(tokenWs) as unknown as Record<string, unknown>;
      } catch (error) {
        logger.error('webpay.commit_error', {
          paymentId: payment.id,
          orderId: payment.orderId,
          token: tokenWs,
          error: error instanceof Error ? error.message : String(error),
        });
        await markPaymentFailed({
          paymentId: payment.id,
          orderId: payment.orderId,
          reason: 'webpay_commit_error',
          responseData: { error: error instanceof Error ? error.message : String(error) },
        });
        return ok({ success: false, message: 'No fue posible confirmar el pago en Webpay' });
      }

      const approved = result.response_code === 0 && result.status === 'AUTHORIZED';
      if (approved) {
        const paid = await markPaymentPaid({
          paymentId: payment.id,
          orderId: payment.orderId,
          externalId: String(result.authorization_code || ''),
          authCode: String(result.authorization_code || ''),
          installments: Number(result.installments_number || 1),
          paymentMethod: String(result.payment_type_code || ''),
          responseData: result as any,
        });

        if (!paid.alreadyPaid) {
          await queueOrderConfirmation(payment.orderId);
        }

        logger.info('webpay.commit_approved', { paymentId: payment.id, orderId: payment.orderId, token: tokenWs });
        return ok({ success: true, orderNumber: payment.order.orderNumber });
      }

      await markPaymentFailed({
        paymentId: payment.id,
        orderId: payment.orderId,
        reason: 'webpay_rejected',
        responseData: result as any,
      });
      logger.warn('webpay.commit_rejected', {
        paymentId: payment.id,
        orderId: payment.orderId,
        token: tokenWs,
        responseCode: result.response_code,
        status: result.status,
      });

      return ok({ success: false, message: 'Pago rechazado por Transbank' });
    }

    if (action === 'mp-preference') {
      const { orderId } = z.object({ orderId: z.string() }).parse(body);
      const order = await findOrderAndValidate(orderId);
      const total = Number(order.total);
      const mode = getMercadoPagoMode(env.MERCADOPAGO_ACCESS_TOKEN);

      const mp = await createMPPreference(
        {
          items: order.items.map((item: any) => ({
            id: item.productId,
            title: item.name,
            quantity: item.quantity,
            unit_price: Number(item.price),
            picture_url: item.product?.images?.[0]?.url,
          })),
          backUrls: {
            success: `${APP_URL}/checkout/mp-return?status=success&orderId=${orderId}`,
            failure: `${APP_URL}/checkout/mp-return?status=failure&orderId=${orderId}`,
            pending: `${APP_URL}/checkout/mp-return?status=pending&orderId=${orderId}`,
          },
          externalReference: order.orderNumber,
          notificationUrl: `${APP_URL}/api/payments?webhook=mp`,
        },
        `divinittys-${orderId}`
      );

      await ensurePaymentRecord(orderId, 'MERCADOPAGO', total);
      await prisma.payment.update({
        where: { orderId },
        data: { externalId: mp.id, status: 'PROCESSING' },
      });

      return ok({
        preferenceId: mp.id,
        initPoint: mp.init_point,
        sandboxInitPoint: mp.sandbox_init_point,
        mode,
        init_point: mode === 'production' ? mp.init_point : mp.sandbox_init_point,
      });
    }

    return badRequest('Acción no válida. Use: webpay-init, webpay-commit, mp-preference');
  } catch (err: any) {
    if (err.code === 404) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err.code === 400) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof z.ZodError) return badRequest('Datos inválidos', err.errors);
    logger.error('payments.route_error', { error: err instanceof Error ? err.message : String(err) });
    return serverError(err);
  }
}

export async function GET(req: NextRequest) {
  return handleMercadoPagoWebhook(req);
}

async function handleMercadoPagoWebhook(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || searchParams.get('topic');
    const dataId = searchParams.get('data.id') || searchParams.get('id');

    if (type === 'payment' && dataId && env.MERCADOPAGO_ACCESS_TOKEN) {
      if (env.MERCADOPAGO_WEBHOOK_SECRET) {
        const validSignature = verifyMercadoPagoSignature(req, dataId, env.MERCADOPAGO_WEBHOOK_SECRET);
        if (!validSignature) {
          logger.warn('mercadopago.webhook_invalid_signature', { dataId });
          return NextResponse.json({ success: false, error: 'Firma inválida' }, { status: 401 });
        }
      }

      const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` },
      });
      const mpPayment = await res.json();

      if (mpPayment.external_reference) {
        const payment = await prisma.payment.findFirst({
          where: { order: { orderNumber: mpPayment.external_reference } },
        });

        if (payment?.status === 'PAID') {
          logger.info('mercadopago.webhook_duplicate', { paymentId: payment.id, dataId });
          return ok({ received: true, duplicate: true });
        }

        if (payment && mpPayment.status === 'approved') {
          await markPaymentPaid({
            paymentId: payment.id,
            orderId: payment.orderId,
            externalId: String(mpPayment.id || dataId),
            paymentMethod: String(mpPayment.payment_method_id || ''),
            responseData: mpPayment,
          });
          await queueOrderConfirmation(payment.orderId);
          logger.info('mercadopago.webhook_approved', {
            paymentId: payment.id,
            orderId: payment.orderId,
            dataId,
            livemode: Boolean(mpPayment.live_mode),
          });
        } else if (payment && ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(String(mpPayment.status))) {
          await markPaymentFailed({
            paymentId: payment.id,
            orderId: payment.orderId,
            reason: `mercadopago_${String(mpPayment.status)}`,
            responseData: mpPayment,
          });
          logger.warn('mercadopago.webhook_failed', {
            paymentId: payment.id,
            orderId: payment.orderId,
            dataId,
            status: mpPayment.status,
          });
        }
      }
    }

    return ok({ received: true });
  } catch (err) {
    logger.error('mercadopago.webhook_error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return serverError(err);
  }
}
