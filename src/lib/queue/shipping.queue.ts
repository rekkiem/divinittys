import { createQueue, createWorker, QueueJob } from './core';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { loadFullOrder } from '@/lib/orders/load-full-order';
import {
  createBluexpressShipment,
  calculatePackageFromOrder,
  type BXShipmentParams,
} from '@/lib/shipping/bluexpress';
import { enqueueVendorAlert } from './notification.queue';

export const shippingQueue = createQueue('shipping');

function getStoreOriginContact() {
  return {
    street: process.env.STORE_ORIGIN_STREET || 'Av. Providencia',
    number: process.env.STORE_ORIGIN_NUMBER || '1000',
    commune: process.env.STORE_ORIGIN_COMMUNE || 'Providencia',
    city: process.env.STORE_ORIGIN_CITY || 'Santiago',
    region: process.env.STORE_ORIGIN_REGION || 'Metropolitana',
    postalCode: process.env.STORE_ORIGIN_ZIP || process.env.STORE_ORIGIN_POSTAL || undefined,
    contactName: process.env.STORE_ORIGIN_CONTACT || 'DIVINITTYS',
    phone: process.env.STORE_ORIGIN_PHONE || '+56900000000',
    email: process.env.STORE_ORIGIN_EMAIL || 'despacho@divinittys.cl',
  };
}

export async function enqueueCreateShipment(orderId: string) {
  await shippingQueue.add(
    'create-shipment',
    { orderId },
    {
      jobId: `ship-${orderId}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
  logger.info('shipping.queued', { orderId });
}

async function notifyVendorSafe(orderId: string) {
  try {
    await enqueueVendorAlert(orderId);
  } catch (e) {
    logger.error('shipping.vendor_alert_enqueue_failed', {
      orderId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function processCreateShipment(orderId: string) {
  const existing = await prisma.shipment.findUnique({ where: { orderId } });
  if (existing) {
    logger.info('shipping.already_exists', { orderId, shipmentId: existing.id });
    await notifyVendorSafe(orderId);
    return existing;
  }

  const order = await loadFullOrder(orderId);
  const pkg = calculatePackageFromOrder(
    order.items.map((i) => ({
      weight: i.product?.weight ? Number(i.product.weight) : null,
      quantity: i.quantity,
    }))
  );
  pkg.value = Number(order.total);

  const destination = order.address
    ? {
        street: order.address.street,
        number: order.address.number,
        apartment: order.address.apartment || undefined,
        commune: order.address.commune,
        city: order.address.city,
        region: order.address.region,
        postalCode: order.address.postalCode || undefined,
        contactName: `${order.address.firstName} ${order.address.lastName}`.trim(),
        phone: order.address.phone || order.guestPhone || order.user?.phone || '+56900000000',
        email: order.user?.email || order.guestEmail || undefined,
      }
    : null;

  if (!destination) {
    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        carrier: 'BLUEXPRESS',
        status: 'READY_TO_SHIP',
        shippingCost: order.shippingAmount,
        packageWeight: pkg.weight,
        packageDimensions: { length: pkg.length, width: pkg.width, height: pkg.height },
        externalData: { manual: true, reason: 'missing_address' },
      },
    });
    logger.warn('shipping.no_address', { orderId });
    await notifyVendorSafe(orderId);
    return shipment;
  }

  const bxParams: BXShipmentParams = {
    reference: order.orderNumber,
    origin: getStoreOriginContact(),
    destination,
    packages: [pkg],
    serviceCode: 'STANDARD',
    declaredValue: Number(order.total),
    notes: order.notes || undefined,
  };

  try {
    const bx = await createBluexpressShipment(bxParams);
    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        carrier: 'BLUEXPRESS',
        trackingNumber: bx.trackingNumber || null,
        labelUrl: bx.labelUrl || null,
        status: bx.trackingNumber ? 'IN_TRANSIT' : 'READY_TO_SHIP',
        shippingCost: order.shippingAmount,
        packageWeight: pkg.weight,
        packageDimensions: { length: pkg.length, width: pkg.width, height: pkg.height },
        originData: bxParams.origin as any,
        destinationData: destination as any,
        externalData: bx as any,
        shippedAt: bx.trackingNumber ? new Date() : null,
      },
    });
    await prisma.order.update({
      where: { id: orderId },
      data: {
        shippingStatus: shipment.status,
        status: shipment.status === 'IN_TRANSIT' ? 'SHIPPED' : 'PROCESSING',
      },
    });
    logger.info('shipping.bluexpress_created', {
      orderId,
      trackingNumber: bx.trackingNumber,
      hasLabel: Boolean(bx.labelUrl),
    });
    await notifyVendorSafe(orderId);
    return shipment;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        carrier: 'BLUEXPRESS',
        status: 'READY_TO_SHIP',
        shippingCost: order.shippingAmount,
        packageWeight: pkg.weight,
        packageDimensions: { length: pkg.length, width: pkg.width, height: pkg.height },
        originData: bxParams.origin as any,
        destinationData: destination as any,
        externalData: { manual: true, reason },
      },
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { shippingStatus: 'READY_TO_SHIP', status: 'PROCESSING' },
    });
    logger.warn('shipment.manual_fallback', { orderId, error: reason });
    await notifyVendorSafe(orderId);
    return shipment;
  }
}

export function startShippingWorker() {
  return createWorker('shipping', async (job: QueueJob) => {
    if (job.name !== 'create-shipment') {
      logger.warn('shipping.unknown_job', { name: job.name });
      return;
    }
    const orderId = String(job.data.orderId || '');
    if (!orderId) throw new Error('shipping job missing orderId');
    return processCreateShipment(orderId);
  });
}
