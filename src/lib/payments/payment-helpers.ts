import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

async function releaseReservedStock(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (item.variantId) {
      await tx.productVariant.updateMany({
        where: { id: item.variantId },
        data: {
          stock: { increment: item.quantity },
        },
      });
      continue;
    }

    await tx.inventory.updateMany({
      where: {
        productId: item.productId,
        reservedStock: { gte: item.quantity },
      },
      data: {
        reservedStock: { decrement: item.quantity },
      },
    });
  }
}

export async function markPaymentFailed(params: {
  paymentId: string;
  orderId: string;
  reason: string;
  responseData?: any;
}) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: { id: params.paymentId },
      select: { status: true },
    });

    if (!existing || existing.status === 'FAILED' || existing.status === 'CANCELLED') {
      return;
    }

    await tx.payment.update({
      where: { id: params.paymentId },
      data: {
        status: 'FAILED',
        errorMessage: params.reason,
        responseData: params.responseData,
      },
    });

    await tx.order.update({
      where: { id: params.orderId },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
      },
    });

    await releaseReservedStock(tx, params.orderId);
  });

  logger.warn('payment.failed', {
    paymentId: params.paymentId,
    orderId: params.orderId,
    reason: params.reason,
  });
}

export async function markPaymentPaid(params: {
  paymentId: string;
  orderId: string;
  responseData: Record<string, unknown> | unknown[] | string | number | boolean | null;
  externalId?: string | null;
  authCode?: string | null;
  installments?: number;
  paymentMethod?: string | null;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: params.paymentId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!payment) {
      throw new Error('Payment not found while marking as paid');
    }

    if (payment.status === 'PAID') {
      return { alreadyPaid: true };
    }

    const items = await tx.orderItem.findMany({ where: { orderId: params.orderId } });

    for (const item of items) {
      if (item.variantId) continue;

      const updated = await tx.inventory.updateMany({
        where: {
          productId: item.productId,
          stock: { gte: item.quantity },
          reservedStock: { gte: item.quantity },
        },
        data: {
          stock: { decrement: item.quantity },
          reservedStock: { decrement: item.quantity },
        },
      });

      if (updated.count !== 1) {
        throw new Error(`Insufficient inventory stock for ${item.productId}`);
      }
    }

    await tx.payment.update({
      where: { id: params.paymentId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        externalId: params.externalId ?? undefined,
        authCode: params.authCode ?? undefined,
        installments: params.installments ?? 1,
        paymentMethod: params.paymentMethod ?? undefined,
        responseData: params.responseData as any,
        errorMessage: null,
      },
    });

    await tx.order.update({
      where: { id: params.orderId },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
      },
    });

    return { alreadyPaid: false };
  });

  logger.info('payment.paid', {
    paymentId: params.paymentId,
    orderId: params.orderId,
    alreadyPaid: result.alreadyPaid,
  });

  return result;
}
