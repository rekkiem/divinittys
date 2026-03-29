import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, created, badRequest, unauthorized, serverError, generateOrderNumber } from '@/lib/utils/api';
import { sanitizeEmail, sanitizeMultilineText, sanitizeText } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().min(1),
  })).min(1),
  shippingData: z.object({
    firstName: z.string().min(1).transform(sanitizeText),
    lastName: z.string().min(1).transform(sanitizeText),
    street: z.string().min(1).transform(sanitizeText),
    number: z.string().min(1).transform(sanitizeText),
    apartment: z.string().optional().transform((value) => (value ? sanitizeText(value) : undefined)),
    commune: z.string().min(1).transform(sanitizeText),
    city: z.string().min(1).transform(sanitizeText),
    region: z.string().min(1).transform(sanitizeText),
    phone: z.string().min(1).transform(sanitizeText),
    email: z.string().email().transform(sanitizeEmail),
  }),
  couponCode: z.string().optional().transform((value) => (value ? sanitizeText(value).toUpperCase() : undefined)),
  shippingService: z.string().optional().transform((value) => (value ? sanitizeText(value) : undefined)),
  notes: z.string().max(1000).optional().transform((value) => (value ? sanitizeMultilineText(value) : undefined)),
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

      const total = price * item.quantity;
      subtotal += total;

      orderItems.push({
        productId: item.productId,
        variantId: item.variantId,
        sku: variant ? variant.sku : product.sku,
        name: variant ? `${product.name} - ${variant.name}` : product.name,
        image: product.images[0]?.url,
        price,
        quantity: item.quantity,
        total,
      });
    }

    // Validate coupon
    let discountAmount = 0;
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
            discountAmount = 0; // Handled in shipping
            break;
        }
      }
    }

    // Shipping cost (simplified)
    const freeShippingThreshold = 50000;
    const shippingAmount = subtotal >= freeShippingThreshold ? 0 : 3990;

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
          notes: data.notes,
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
          continue;
        }

        if (products.find((product: any) => product.id === item.productId)?.inventory?.trackStock) {
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

    logger.info('order.created', { orderId: order.id, orderNumber: order.orderNumber, userId: user?.id ?? null });
    return created({ order });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest('Datos inválidos', error.errors);
    }
    return serverError(error);
  }
}
