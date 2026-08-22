import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, created, badRequest, unauthorized, serverError, generateOrderNumber } from '@/lib/utils/api';

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
  // Cotización del checkout (validada con techo para evitar manipulación)
  shippingAmount: z.number().min(0).max(50000).optional(),
  notes: z.string().optional(),
});

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

    // Fetch and validate products
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

    // Calculate totals
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

    // Validate coupon
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

    // Shipping: preferir cotización del checkout; fallback fijo
    const freeShippingThreshold = 50000;
    let shippingAmount: number;
    if (freeShippingCoupon || subtotal >= freeShippingThreshold) {
      shippingAmount = 0;
    } else if (typeof data.shippingAmount === 'number') {
      shippingAmount = data.shippingAmount;
    } else {
      shippingAmount = 3990;
    }

    const total = subtotal - discountAmount + shippingAmount;

    // Create order
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
          notes: data.notes
            ? data.shippingService
              ? `${data.notes} | Envío: ${data.shippingService}`
              : data.notes
            : data.shippingService
              ? `Envío: ${data.shippingService}`
              : undefined,
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

      // Reserve stock
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

      // Update coupon usage
      if (data.couponCode) {
        await tx.coupon.update({
          where: { code: data.couponCode.toUpperCase() },
          data: { usedCount: { increment: 1 } },
        });
      }

      return newOrder;
    });

    return created({ order });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest('Datos inválidos', error.errors);
    }
    return serverError(error);
  }
}
