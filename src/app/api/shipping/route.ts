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

// Cotización: permitir dirección parcial (commune + region mínimo)
const quoteDestinationSchema = z.object({
  street: z.string().optional().default(''),
  number: z.string().optional().default(''),
  apartment: z.string().optional(),
  commune: z.string().min(1),
  city: z.string().optional().default(''),
  region: z.string().min(1),
  postalCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json();
    // Aceptar action por query o body (compatibilidad con clientes antiguos)
    const action = searchParams.get('action') || body.action;

    // ---- Quote ----
    if (action === 'quote') {
      const { destination, items } = z
        .object({
          destination: quoteDestinationSchema,
          items: z
            .array(
              z.object({
                weight: z.number().optional(),
                quantity: z.number().min(1),
              })
            )
            .min(1)
            .optional(),
          // Compat: algunos clientes mandaban solo weight
          weight: z.number().optional(),
        })
        .parse(body);

      const packageItems =
        items && items.length > 0
          ? items
          : [{ quantity: 1, weight: body.weight ?? 0.5 }];

      const packageData = calculatePackageFromOrder(packageItems);
      const quotes = await quoteBluexpress(
        {
          street: destination.street || 'N/A',
          number: destination.number || '0',
          apartment: destination.apartment,
          commune: destination.commune,
          city: destination.city || destination.commune,
          region: destination.region,
          postalCode: destination.postalCode,
        },
        [packageData]
      );

      // Normalizar para el frontend
      const normalized = (quotes || []).map((q) => ({
        price: q.price,
        days: q.estimatedDays,
        service: q.serviceName,
        serviceCode: q.serviceCode,
        currency: q.currency || 'CLP',
      }));

      return ok({
        quotes: normalized,
        // Primera cotización como atajo (CheckoutForm)
        price: normalized[0]?.price ?? 3990,
        days: normalized[0]?.days ?? 3,
        service: normalized[0]?.service ?? 'Bluexpress Estándar',
        package: packageData,
      });
    }

    // ---- Create Shipment (Admin) ----
    if (action === 'create') {
      const user = await getAuthUser(req);
      if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        return badRequest('No autorizado');
      }

      const { orderId, serviceCode } = z
        .object({
          orderId: z.string(),
          serviceCode: z.string(),
        })
        .parse(body);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
        },
      });

      if (!order) return notFound('Pedido no encontrado');

      const shippingData = order.shippingData as any;
      const packageData = calculatePackageFromOrder(
        order.items.map((i: any) => ({
          weight: i.product.weight ? Number(i.product.weight) : undefined,
          quantity: i.quantity,
        }))
      );

      const shipmentResult = await createBluexpressShipment({
        reference: order.orderNumber,
        origin: {
          street: process.env.STORE_ORIGIN_STREET || 'Su dirección de despacho',
          number: process.env.STORE_ORIGIN_NUMBER || '123',
          commune: process.env.STORE_ORIGIN_COMMUNE || 'Providencia',
          city: process.env.STORE_ORIGIN_CITY || 'Santiago',
          region: process.env.STORE_ORIGIN_REGION || 'Metropolitana',
          contactName: 'DIVINITTYS',
          phone: process.env.STORE_ORIGIN_PHONE || '+56 9 0000 0000',
          email: process.env.STORE_ORIGIN_EMAIL || 'despacho@divinittys.cl',
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
    if (error instanceof z.ZodError) {
      return badRequest('Datos inválidos', error.errors);
    }
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
