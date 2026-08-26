/**
 * /api/payments — Payment gateway integration
 * Supports: Transbank Webpay Plus + MercadoPago
 *
 * POST /api/payments?action=webpay-init      → init Webpay transaction
 * POST /api/payments?action=webpay-commit    → commit after redirect
 * POST /api/payments?action=mp-preference   → create MP preference
 * POST /api/payments?action=mp-confirm      → confirm MP payment after return
 * POST /api/payments                         → auto-detect from body.provider
 * GET  /api/payments                         → MercadoPago webhook (IPN legacy)
 * Preferencias nuevas notifican a /api/webhooks/mercadopago (POST)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createWebpayTransaction, commitWebpayTransaction } from '@/lib/payments/webpay';
import { createMPPreference, isSandbox } from '@/lib/payments/mercadopago';
import { markPaymentFailed, markPaymentPaid } from '@/lib/payments/payment-helpers';
import { verifyMercadoPagoSignature } from '@/lib/payments/mercadopago-webhook';
import { ok, badRequest, notFound, serverError } from '@/lib/utils/api';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function findOrderAndValidate(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payment: true,
      items: { include: { product: { include: { images: { where: { isMain: true }, take: 1 } } } } },
    },
  });
  if (!order) throw Object.assign(new Error('Pedido no encontrado'), { code: 404 });
  if (order.payment?.status === 'PAID') {
    throw Object.assign(new Error('Este pedido ya fue pagado'), { code: 400 });
  }
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

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    let action = searchParams.get('action');
    if (!action) {
      const provider = String(body.provider || '').toUpperCase();
      action = provider === 'MERCADOPAGO' ? 'mp-preference' : 'webpay-init';
    }

    // ── Webpay init ─────────────────────────────────────────────────
    if (action === 'webpay-init') {
      const { orderId } = z.object({ orderId: z.string() }).parse(body);
      const order = await findOrderAndValidate(orderId);
      const total = Number(order.total);

      const result = await createWebpayTransaction({
        buyOrder: order.orderNumber.replace(/[^a-zA-Z0-9]/g, '').slice(0, 26),
        sessionId: orderId.slice(0, 61),
        amount: Math.round(total),
        returnUrl: `${APP_URL}/checkout/webpay-return`,
      });

      await ensurePaymentRecord(orderId, 'WEBPAY', total);
      await prisma.payment.update({
        where: { orderId },
        data: { externalId: result.token, status: 'PROCESSING' },
      });

      return ok({ url: result.url, token: result.token });
    }

    // ── Webpay commit ───────────────────────────────────────────────
    if (action === 'webpay-commit') {
      const { token_ws } = z.object({ token_ws: z.string() }).parse(body);
      const payment = await prisma.payment.findFirst({
        where: { externalId: token_ws },
        include: { order: true },
      });
      if (!payment) return notFound('Transacción no encontrada');

      const result = await commitWebpayTransaction(token_ws);

      if ((result as any).status === 'AUTHORIZED' || (result as any).response_code === 0) {
        await markPaymentPaid({
          paymentId: payment.id,
          orderId: payment.orderId,
          responseData: result as any,
          externalId: (result as any).authorization_code,
          authCode: (result as any).authorization_code,
          installments: (result as any).installments_number || 1,
          paymentMethod: (result as any).payment_type_code,
        });
        return ok({ success: true, orderNumber: payment.order.orderNumber });
      } else {
        await markPaymentFailed({
          paymentId: payment.id,
          orderId: payment.orderId,
          reason: 'Pago rechazado por Transbank',
          responseData: result as any,
        });
        return ok({ success: false, message: 'Pago rechazado por Transbank' });
      }
    }

    if (action === 'mp-preference') {
      const { orderId } = z.object({ orderId: z.string() }).parse(body);
      const order = await findOrderAndValidate(orderId);
      const total = Number(order.total);

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
          // Webhook POST dedicado (C-02)
          notificationUrl: `${APP_URL}/api/webhooks/mercadopago`,
        },
        `divinittys-${orderId}`
      );

      await ensurePaymentRecord(orderId, 'MERCADOPAGO', total);
      await prisma.payment.update({
        where: { orderId },
        data: { externalId: mp.id, status: 'PROCESSING' },
      });

      const checkoutUrl = isSandbox()
        ? mp.sandbox_init_point || mp.init_point
        : mp.init_point || mp.sandbox_init_point;

      return ok({
        preferenceId: mp.id,
        initPoint: mp.init_point,
        sandboxInitPoint: mp.sandbox_init_point,
        init_point: checkoutUrl,
        isSandbox: isSandbox(),
      });
    }

    if (action === 'mp-confirm') {
      const schema = z.object({
        paymentId: z.string().min(1),
        orderId: z.string().optional(),
        orderNumber: z.string().optional(),
      });
      const { paymentId, orderId, orderNumber } = schema.parse(body);

      if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
        return badRequest('MercadoPago no configurado');
      }

      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
      });
      if (!res.ok) {
        return badRequest('No se pudo validar el pago en Mercado Pago');
      }

      const mpPayment = await res.json();

      const payment = await prisma.payment.findFirst({
        where: orderId
          ? { orderId }
          : {
              order: {
                orderNumber:
                  orderNumber ||
                  (mpPayment.external_reference
                    ? String(mpPayment.external_reference)
                    : ''),
              },
            },
        include: { order: true },
      });

      if (!payment) {
        return notFound('Pago/pedido no encontrado');
      }

      if (mpPayment.status === 'approved') {
        await markPaymentPaid({
          paymentId: payment.id,
          orderId: payment.orderId,
          responseData: mpPayment,
          externalId: String(mpPayment.id ?? paymentId),
          paymentMethod: mpPayment.payment_method_id ?? null,
          installments: Number(mpPayment.installments || 1),
        });
        return ok({
          success: true,
          orderNumber: payment.order.orderNumber,
          status: 'PAID',
        });
      }

      if (['rejected', 'cancelled', 'refunded'].includes(String(mpPayment.status || ''))) {
        await markPaymentFailed({
          paymentId: payment.id,
          orderId: payment.orderId,
          reason: `Pago MercadoPago ${mpPayment.status}`,
          responseData: mpPayment,
        });
        return ok({ success: false, status: mpPayment.status });
      }

      return ok({
        success: false,
        status: mpPayment.status,
        message: 'Pago aún no aprobado',
      });
    }

    return badRequest('Acción no válida. Use: webpay-init, webpay-commit, mp-preference, mp-confirm');
  } catch (err: any) {
    if (err.code === 404) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err.code === 400) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof z.ZodError) return badRequest('Datos inválidos', err.errors);
    return serverError(err);
  }
}

// Legacy GET IPN (compat)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const dataId = searchParams.get('data.id') || searchParams.get('id');
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    if (type === 'payment' && dataId && webhookSecret) {
      const isValid = verifyMercadoPagoSignature(req, dataId, webhookSecret);
      if (!isValid) {
        return NextResponse.json({ error: 'Firma de webhook inválida' }, { status: 401 });
      }
    }

    if (type === 'payment' && dataId && process.env.MERCADOPAGO_ACCESS_TOKEN) {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: 'No se pudo validar el pago en Mercado Pago' },
          { status: 502 }
        );
      }
      const mpPayment = await res.json();

      if (mpPayment.external_reference) {
        const payment = await prisma.payment.findFirst({
          where: { order: { orderNumber: mpPayment.external_reference } },
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
          ['rejected', 'cancelled'].includes(mpPayment.status)
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
