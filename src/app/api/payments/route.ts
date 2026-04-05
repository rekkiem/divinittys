/**
 * /api/payments — Payment gateway integration
 * Supports: Transbank Webpay Plus + MercadoPago
 *
 * POST /api/payments?action=webpay-init      → init Webpay transaction
 * POST /api/payments?action=webpay-commit    → commit after redirect
 * POST /api/payments?action=mp-preference   → create MP preference
 * POST /api/payments                         → auto-detect from body.provider
 * GET  /api/payments                         → MercadoPago webhook (IPN)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createWebpayTransaction, commitWebpayTransaction } from '@/lib/payments/webpay';
import { createMPPreference } from '@/lib/payments/mercadopago';
import { ok, badRequest, notFound, serverError } from '@/lib/utils/api';
import { getAuthUser } from '@/lib/auth';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ── Helpers ──────────────────────────────────────────────────────
async function findOrderAndValidate(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payment: true,
      items: { include: { product: { include: { images: { where: { isMain: true }, take: 1 } } } } },
    },
  });
  if (!order)                          throw Object.assign(new Error('Pedido no encontrado'), { code: 404 });
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

// ── POST handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    // Auto-detect action: from ?action= or from body.provider
    let action = searchParams.get('action');
    if (!action) {
      const provider = String(body.provider || '').toUpperCase();
      action = provider === 'MERCADOPAGO' ? 'mp-preference' : 'webpay-init';
    }

    // ── Webpay: init ─────────────────────────────────────────────
    if (action === 'webpay-init') {
      const { orderId } = z.object({ orderId: z.string() }).parse(body);

      const order = await findOrderAndValidate(orderId);
      const total = Number(order.total);

      const tbk = await createWebpayTransaction({
        buyOrder:  order.orderNumber.slice(0, 26), // Transbank max 26 chars
        sessionId: `${orderId.slice(0, 8)}-${Date.now()}`,
        amount:    total,
        returnUrl: `${APP_URL}/checkout/webpay-return`,
      });

      await ensurePaymentRecord(orderId, 'WEBPAY', total);
      await prisma.payment.update({
        where: { orderId },
        data: { token: tbk.token, status: 'PROCESSING' },
      });

      return ok({ token: tbk.token, url: tbk.url });
    }

    // ── Webpay: commit ───────────────────────────────────────────
    if (action === 'webpay-commit') {
      const { token_ws } = z.object({ token_ws: z.string() }).parse(body);

      const payment = await prisma.payment.findFirst({
        where: { token: token_ws },
        include: { order: true },
      });
      if (!payment) return notFound('Pago no encontrado');

      const result = await commitWebpayTransaction(token_ws);
      const approved = result && (result as any).response_code === 0 && (result as any).status === 'AUTHORIZED';

      if (approved) {
        await prisma.$transaction(async (tx: any) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID', paidAt: new Date(),
              externalId:    (result as any).authorization_code,
              authCode:      (result as any).authorization_code,
              installments:  (result as any).installments_number || 1,
              paymentMethod: (result as any).payment_type_code,
              responseData:  result as any,
            },
          });
          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
          });
          // Decrement actual stock
          const items = await tx.orderItem.findMany({ where: { orderId: payment.orderId } });
          for (const item of items) {
            await tx.inventory.updateMany({
              where: { productId: item.productId },
              data: { stock: { decrement: item.quantity }, reservedStock: { decrement: item.quantity } },
            });
          }
        });
        return ok({ success: true, orderNumber: payment.order.orderNumber });
      } else {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', responseData: result as any },
        });
        await prisma.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: 'FAILED' },
        });
        return ok({ success: false, message: 'Pago rechazado por Transbank' });
      }
    }

    // ── MercadoPago: preference ───────────────────────────────────
    if (action === 'mp-preference') {
      const { orderId } = z.object({ orderId: z.string() }).parse(body);
      const order = await findOrderAndValidate(orderId);
      const total = Number(order.total);

      const mp = await createMPPreference(
        {
          items: order.items.map((item: any) => ({
            id:         item.productId,
            title:      item.name,
            quantity:   item.quantity,
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
        preferenceId:    mp.id,
        initPoint:       mp.init_point,
        sandboxInitPoint: mp.sandbox_init_point,
        // CheckoutForm uses init_point key
        init_point:      process.env.NODE_ENV === 'production' ? mp.init_point : mp.sandbox_init_point,
      });
    }

    return badRequest('Acción no válida. Use: webpay-init, webpay-commit, mp-preference');
  } catch (err: any) {
    if (err.code === 404) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err.code === 400) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof z.ZodError) return badRequest('Datos inválidos', err.errors);
    console.error('[Payments] Error:', err);
    return serverError(err);
  }
}

// ── GET: MercadoPago Webhook ──────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type   = searchParams.get('type');
    const dataId = searchParams.get('data.id') || searchParams.get('id');

    if (type === 'payment' && dataId && process.env.MERCADOPAGO_ACCESS_TOKEN) {
      const res  = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
      });
      const mpPayment = await res.json();

      if (mpPayment.external_reference) {
        const payment = await prisma.payment.findFirst({
          where: { order: { orderNumber: mpPayment.external_reference } },
        });
        if (payment && mpPayment.status === 'approved') {
          await prisma.$transaction([
            prisma.payment.update({
              where: { id: payment.id },
              data: { status: 'PAID', paidAt: new Date(), responseData: mpPayment },
            }),
            prisma.order.update({
              where: { id: payment.orderId },
              data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
            }),
          ]);
        }
      }
    }

    return ok({ received: true });
  } catch (err) {
    return serverError(err);
  }
}
