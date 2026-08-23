/**
 * Cancela pedidos abandonados y libera stock reservado.
 *
 * Criterio por defecto:
 * - order.status = PENDING
 * - paymentStatus in (PENDING, PROCESSING, FAILED)
 * - createdAt < now - ORDER_ABANDON_MINUTES (default 120)
 */
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

async function releaseReservedStock(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (item.variantId) {
      await tx.productVariant.updateMany({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
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

async function rollbackCoupon(tx: Prisma.TransactionClient, couponCode: string | null | undefined) {
  if (!couponCode) return;
  await tx.coupon.updateMany({
    where: {
      code: couponCode.toUpperCase(),
      usedCount: { gt: 0 },
    },
    data: { usedCount: { decrement: 1 } },
  });
}

export type CleanupResult = {
  scanned: number;
  cancelled: number;
  orderIds: string[];
  olderThanMinutes: number;
};

export async function cancelAbandonedOrders(options?: {
  olderThanMinutes?: number;
  limit?: number;
}): Promise<CleanupResult> {
  const olderThanMinutes = Math.max(
    15,
    options?.olderThanMinutes ?? Number(process.env.ORDER_ABANDON_MINUTES || 120)
  );
  const limit = Math.min(500, Math.max(1, options?.limit ?? 100));
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const candidates = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      paymentStatus: { in: ['PENDING', 'PROCESSING', 'FAILED'] },
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      orderNumber: true,
      notes: true,
      couponCode: true,
      payment: { select: { id: true, status: true } },
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });

  const cancelledIds: string[] = [];
  const marker = 'Auto-cancelado: pago abandonado';

  for (const order of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.order.findUnique({
          where: { id: order.id },
          select: { status: true, paymentStatus: true, notes: true, couponCode: true },
        });

        if (!fresh || fresh.status !== 'PENDING') return;
        if (fresh.paymentStatus === 'PAID') return;

        const notes =
          !fresh.notes || fresh.notes.includes(marker)
            ? fresh.notes || marker
            : `${fresh.notes} | ${marker}`;

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            paymentStatus: 'CANCELLED',
            notes,
          },
        });

        if (order.payment?.id) {
          await tx.payment.updateMany({
            where: {
              id: order.payment.id,
              status: { notIn: ['PAID', 'REFUNDED'] },
            },
            data: {
              status: 'CANCELLED',
              errorMessage: 'Pedido abandonado: pago no completado a tiempo',
            },
          });
        }

        await releaseReservedStock(tx, order.id);
        await rollbackCoupon(tx, fresh.couponCode);
      });

      cancelledIds.push(order.id);
      logger.info('orders.abandoned_cancelled', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        olderThanMinutes,
      });
    } catch (err) {
      logger.error('orders.abandoned_cancel_failed', {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    scanned: candidates.length,
    cancelled: cancelledIds.length,
    orderIds: cancelledIds,
    olderThanMinutes,
  };
}
