import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createWebpayTransaction, commitWebpayTransaction } from '@/lib/payments/webpay';
import { createMPPreference } from '@/lib/payments/mercadopago';
import { ok, badRequest, notFound, serverError } from '@/lib/utils/api';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const body = await req.json();

    // ---- Webpay: Initiate ----
    if (action === 'webpay-init') {
      const { orderId } = z.object({ orderId: z.string() }).parse(body);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payment: true },
      });

      if (!order) return notFound('Pedido no encontrado');
      if (order.payment?.status === 'PAID') return badRequest('Pedido ya pagado');

      const tbkResponse = await createWebpayTransaction({
        buyOrder: order.orderNumber,
        sessionId: `${orderId}-${Date.now()}`,
        amount: Number(order.total),
        returnUrl: `${APP_URL}/checkout/webpay-return`,
      });

      await prisma.payment.update({
        where: { orderId },
        data: { token: tbkResponse.token, status: 'PROCESSING', provider: 'WEBPAY' },
      });

      return ok({ token: tbkResponse.token, url: tbkResponse.url });
    }

    // ---- Webpay: Commit ----
    if (action === 'webpay-commit') {
      const { token_ws } = z.object({ token_ws: z.string() }).parse(body);

      const payment = await prisma.payment.findFirst({
        where: { token: token_ws },
        include: { order: true },
      });

      if (!payment) return notFound('Pago no encontrado');

      const tbkResult = await commitWebpayTransaction(token_ws);

      // response_code === 0 means approved in Webpay SDK v6
      const isApproved =
        tbkResult &&
        (tbkResult as any).response_code === 0 &&
        (tbkResult as any).status === 'AUTHORIZED';

      if (isApproved) {
        await prisma.$transaction(async (tx: any) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID',
              externalId: (tbkResult as any).authorization_code,
              authCode: (tbkResult as any).authorization_code,
              installments: (tbkResult as any).installments_number || 1,
              paymentMethod: (tbkResult as any).payment_type_code,
              responseData: tbkResult as any,
              paidAt: new Date(),
            },
          });

          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
          });

          const orderItems = await tx.orderItem.findMany({
            where: { orderId: payment.orderId },
          });
          for (const item of orderItems) {
            await tx.inventory.updateMany({
              where: { productId: item.productId },
              data: {
                stock: { decrement: item.quantity },
                reservedStock: { decrement: item.quantity },
              },
            });
          }
        });

        return ok({ success: true, orderNumber: payment.order.orderNumber });
      } else {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', responseData: tbkResult as any },
        });
        await prisma.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: 'FAILED' },
        });

        return ok({ success: false, message: 'Pago rechazado por Transbank' });
      }
    }

    // ---- MercadoPago: Create Preference ----
    if (action === 'mp-preference') {
      const { orderId } = z.object({ orderId: z.string() }).parse(body);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: { include: { images: { take: 1 } } } } },
          payment: true,
        },
      });

      if (!order) return notFound('Pedido no encontrado');

      const mpResponse = await createMPPreference(
        {
          items: order.items.map((item: any) => ({
            id: item.productId,
            title: item.name,
            quantity: item.quantity,
            unit_price: Number(item.price),
            picture_url: item.product.images[0]?.url,
          })),
          backUrls: {
            success: `${APP_URL}/checkout/mp-return?status=success&orderId=${orderId}`,
            failure: `${APP_URL}/checkout/mp-return?status=failure&orderId=${orderId}`,
            pending: `${APP_URL}/checkout/mp-return?status=pending&orderId=${orderId}`,
          },
          externalReference: order.orderNumber,
          notificationUrl: `${APP_URL}/api/payments/mp-webhook`,
        },
        `divinittys-${orderId}`
      );

      await prisma.payment.update({
        where: { orderId },
        data: { externalId: mpResponse.id, status: 'PROCESSING', provider: 'MERCADOPAGO' },
      });

      return ok({
        preferenceId: mpResponse.id,
        initPoint: mpResponse.init_point,
        sandboxInitPoint: mpResponse.sandbox_init_point,
      });
    }

    return badRequest('Acción no válida');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest('Datos inválidos', error.errors);
    }
    return serverError(error);
  }
}

// ---- MercadoPago Webhook ----
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const dataId = searchParams.get('data.id');

    if (type === 'payment' && dataId) {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
      });
      const mpPayment = await res.json();

      if (mpPayment.status === 'approved') {
        const payment = await prisma.payment.findFirst({
          where: { externalId: mpPayment.preference_id },
        });
        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'PAID', paidAt: new Date(), responseData: mpPayment },
          });
          await prisma.order.update({
            where: { id: payment.orderId },
            data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
          });
        }
      }
    }

    return ok({ received: true });
  } catch (error) {
    return serverError(error);
  }
}
