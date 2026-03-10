import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { quoteBluexpress, createBluexpressShipment, trackBluexpress, calculatePackageFromOrder } from '@/lib/shipping/bluexpress';
import { ok, badRequest, notFound, serverError } from '@/lib/utils/api';
import { getAuthUser } from '@/lib/auth';

const addressSchema = z.object({
  street: z.string(),
  number: z.string(),
  apartment: z.string().optional(),
  commune: z.string(),
  city: z.string(),
  region: z.string(),
  postalCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const body = await req.json();

    // ---- Quote ----
    if (action === 'quote') {
      const { destination, items } = z.object({
        destination: addressSchema,
        items: z.array(z.object({
          weight: z.number().optional(),
          quantity: z.number(),
        })),
      }).parse(body);

      const packageData = calculatePackageFromOrder(items);
      const quotes = await quoteBluexpress(destination, [packageData]);

      return ok({ quotes, package: packageData });
    }

    // ---- Create Shipment (Admin) ----
    if (action === 'create') {
      const user = await getAuthUser(req);
      if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        return badRequest('No autorizado');
      }

      const { orderId, serviceCode } = z.object({
        orderId: z.string(),
        serviceCode: z.string(),
      }).parse(body);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
        },
      });

      if (!order) return notFound('Pedido no encontrado');

      const shippingData = order.shippingData as any;
      const packageData = calculatePackageFromOrder(
        order.items.map((i) => ({
          weight: i.product.weight ? Number(i.product.weight) : undefined,
          quantity: i.quantity,
        }))
      );

      const shipmentResult = await createBluexpressShipment({
        reference: order.orderNumber,
        origin: {
          street: 'Su dirección de despacho',
          number: '123',
          commune: 'Providencia',
          city: 'Santiago',
          region: 'Metropolitana',
          contactName: 'DIVINITTYS',
          phone: '+56 9 xxxx xxxx',
          email: 'despacho@divinittys.cl',
        },
        destination: {
          ...shippingData,
          contactName: `${shippingData.firstName} ${shippingData.lastName}`,
          phone: shippingData.phone,
          email: shippingData.email,
        },
        packages: [packageData],
        serviceCode,
        declaredValue: Number(order.total),
      });

      await prisma.shipment.upsert({
        where: { orderId },
        update: {
          trackingNumber: shipmentResult.trackingNumber,
          labelUrl: shipmentResult.labelUrl,
          status: 'IN_TRANSIT',
          shippedAt: new Date(),
        },
        create: {
          orderId,
          carrier: 'BLUEXPRESS',
          trackingNumber: shipmentResult.trackingNumber,
          labelUrl: shipmentResult.labelUrl,
          status: 'IN_TRANSIT',
          packageWeight: packageData.weight,
          packageDimensions: {
            length: packageData.length,
            width: packageData.width,
            height: packageData.height,
          },
          shippedAt: new Date(),
        },
      });

      await prisma.order.update({
        where: { id: orderId },
        data: { shippingStatus: 'IN_TRANSIT', status: 'SHIPPED' },
      });

      return ok({ shipment: shipmentResult });
    }

    return badRequest('Acción no válida');
  } catch (error) {
    return serverError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const trackingNumber = searchParams.get('tracking');

    if (!trackingNumber) return badRequest('Número de seguimiento requerido');

    const events = await trackBluexpress(trackingNumber);
    return ok({ trackingNumber, events });
  } catch (error) {
    return serverError(error);
  }
}
