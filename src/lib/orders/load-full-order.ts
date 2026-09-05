/**
 * Carga un Order completo para fulfillment (email, shipping, notificación).
 * Usado por fulfillment.queue, shipping.queue y notification.queue.
 */
import { prisma } from '@/lib/prisma';

export type FullOrder = NonNullable<Awaited<ReturnType<typeof loadFullOrder>>>;

export async function loadFullOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              weight: true,
              imageUrl: true,
            },
          },
          variant: {
            select: { id: true, name: true, sku: true },
          },
        },
      },
      address: true,
      payment: true,
      shipment: true,
      user: {
        select: { id: true, email: true, name: true, phone: true },
      },
    },
  });

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  return order;
}

/** Email del comprador: usuario autenticado o guest */
export function getBuyerEmail(order: FullOrder): string | null {
  return order.user?.email || order.guestEmail || null;
}

/** Nombre del comprador */
export function getBuyerName(order: FullOrder): string {
  if (order.user?.name) return order.user.name;
  if (order.guestName) return order.guestName;
  if (order.address) return `${order.address.firstName} ${order.address.lastName}`.trim();
  return 'Cliente';
}
