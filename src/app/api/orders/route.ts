import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, created, badRequest, unauthorized, serverError, generateOrderNumber } from '@/lib/utils/api';
import { quoteBluexpress, calculatePackageFromOrder } from '@/lib/shipping/bluexpress';

const MAX_SHIPPING_CLP = 15000;
const SHIPPING_TOLERANCE = 0.15; // ±15%
const FREE_SHIPPING_THRESHOLD = 50000;

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().optional(),
        quantity: z.number().min(1),
      })
    )
    .min(1),
  shippingData: z.object({
    firstName: z.string(),
    lastName: z.string(),
    street: z.string(),
    number: z.string(),
    apartment: z.string().optional(),
    commune: z.string(),
    city: z.string(),
    region: z.string(),
    phone: z.string(),
    email: z.string().email(),
  }),
  couponCode: z.string().optional(),
  shippingService: z.string().optional(),
  shippingAmount: z.number().min(0).max(MAX_SHIPPING_CLP).optional(),
  notes: z.string().optional(),
});

/** Valida o recalcula el monto de envío contra cotización server-side */
async function resolveShippingAmount(params: {
  clientAmount?: number;
  shippingService?: string;
  shippingData: z.infer<typeof createOrderSchema>['shippingData'];
  items: { quantity: number }[];
  freeShipping: boolean;
}): Promise<{ amount: number; source: string }> {
  if (params.freeShipping) {
    return { amount: 0, source: 'free' };
  }

  // Re-cotizar en servidor
  let serverQuotes: { price: number; serviceName: string; serviceCode: string }[] = [];
  try {
    const pkg = calculatePackageFromOrder(
      params.items.map((i) => ({ quantity: i.quantity, weight: 0.5 }))
    );
    const quotes = await quoteBluexpress(
      {
        street: params.shippingData.street,
        number: params.shippingData.number,
        apartment: params.shippingData.apartment,
        commune: params.shippingData.commune,
        city: params.shippingData.city || params.shippingData.commune,
        region: params.shippingData.region,
      },
      [pkg]
    );
    serverQuotes = quotes.map((q) => ({
      price: Number(q.price),
      serviceName: q.serviceName,
      serviceCode: q.serviceCode,
    }));
  } catch {
    serverQuotes = [];
  }

  const fallback = 3990;

  if (typeof params.clientAmount !== 'number') {
    return {
      amount: serverQuotes[0]?.price ?? fallback,
      source: serverQuotes.length ? 'server-quote' : 'fallback',
    };
  }

  const client = params.clientAmount;

  // Match por servicio si se indicó
  let matched = serverQuotes[0];
  if (params.shippingService && serverQuotes.length) {
    const byName = serverQuotes.find(
      (q) =>
        q.serviceName === params.shippingService ||
        q.serviceCode === params.shippingService ||
        params.shippingService!.toLowerCase().includes(q.serviceCode.toLowerCase())
    );
    if (byName) matched = byName;
  }

  if (matched) {
    const min = matched.price * (1 - SHIPPING_TOLERANCE);
    const max = matched.price * (1 + SHIPPING_TOLERANCE);
    if (client < min || client > max) {
      // No confiar en el cliente: usar precio del servidor
      return { amount: matched.price, source: 'server-override' };
    }
    return { amount: client, source: 'client-validated' };
  }

  // Sin cotización server usable: techo estricto + banda razonable de mock (2000-6000)
  if (client > MAX_SHIPPING_CLP) {
    return { amount: fallback, source: 'capped' };
  }
  if (client > 0 && (client < 1500 || client > 8000)) {
    return { amount: fallback, source: 'out-of-band-fallback' };
  }

  return { amount: client, source: 'client-accepted' };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            product: {
              include: { images: { where: { isMain: true }, take: 1 } },
            },
          },
        },
        payment: { select: { status: true, provider: true } },
        shipment: { select: { trackingNumber: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ok({ orders });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const body = await req.json();
    const data = createOrderSchema.parse(body);

    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: {
        inventory: true,
        variants: true,
        images: { where: { isMain: true }, take: 1 },
      },
    });

    if (products.length !== data.items.length) {
      return badRequest('Algunos productos no están disponibles');
    }

    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of data.items) {
      const product = products.find((p: any) => p.id === item.productId)!;
      const variant = item.variantId
        ? product.variants.find((v: any) => v.id === item.variantId)
        : null;

      const price = variant ? Number(variant.price) : Number(product.basePrice);
      const stock = variant ? variant.stock : (product.inventory?.stock ?? 0);

      if (product.inventory?.trackStock && stock < item.quantity) {
        return badRequest(`Stock insuficiente para "${product.name}"`);
      }

      const lineTotal = price * item.quantity;
      subtotal += lineTotal;

      orderItems.push({
        productId: item.productId,
        variantId: item.variantId,
        sku: variant ? variant.sku : product.sku,
        name: variant ? `${product.name} - ${variant.name}` : product.name,
        image: product.images[0]?.url,
        price,
        quantity: item.quantity,
        total: lineTotal,
      });
    }

    let discountAmount = 0;
    let freeShippingCoupon = false;
    if (data.couponCode) {
      const coupon = await prisma.coupon.findFirst({
        where: {
          code: data.couponCode.toUpperCase(),
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
      });

      if (coupon) {
        if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
          return badRequest(`El cupón requiere un mínimo de $${coupon.minOrderAmount}`);
        }
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
          return badRequest('Cupón agotado');
        }

        switch (coupon.type) {
          case 'PERCENTAGE':
            discountAmount = subtotal * (Number(coupon.value) / 100);
            break;
          case 'FIXED_AMOUNT':
            discountAmount = Math.min(Number(coupon.value), subtotal);
            break;
          case 'FREE_SHIPPING':
            freeShippingCoupon = true;
            break;
        }
      }
    }

    const freeShipping = freeShippingCoupon || subtotal >= FREE_SHIPPING_THRESHOLD;
    const shipping = await resolveShippingAmount({
      clientAmount: data.shippingAmount,
      shippingService: data.shippingService,
      shippingData: data.shippingData,
      items: data.items,
      freeShipping,
    });

    const shippingAmount = shipping.amount;
    const total = subtotal - discountAmount + shippingAmount;

    const order = await prisma.$transaction(async (tx: any) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: user?.id,
          status: 'PENDING',
          subtotal,
          discountAmount,
          shippingAmount,
          total,
          guestEmail: !user ? data.shippingData.email : undefined,
          shippingData: data.shippingData,
          couponCode: data.couponCode,
          notes: [
            data.notes,
            data.shippingService ? `Envío: ${data.shippingService}` : null,
            `shipping_source=${shipping.source}`,
          ]
            .filter(Boolean)
            .join(' | '),
          items: { create: orderItems },
          payment: {
            create: {
              provider: 'WEBPAY',
              status: 'PENDING',
              amount: total,
              currency: 'CLP',
            },
          },
        },
        include: { items: true, payment: true },
      });

      for (const item of data.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          });
        } else {
          await tx.inventory.updateMany({
            where: { productId: item.productId },
            data: { reservedStock: { increment: item.quantity } },
          });
        }
      }

      if (data.couponCode) {
        await tx.coupon.update({
          where: { code: data.couponCode.toUpperCase() },
          data: { usedCount: { increment: 1 } },
        });
      }

      return newOrder;
    });

    return created({ order, shippingSource: shipping.source });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest('Datos inválidos', error.errors);
    }
    return serverError(error);
  }
}
