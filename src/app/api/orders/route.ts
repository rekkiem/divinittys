import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ok, created, badRequest, unauthorized, serverError, generateOrderNumber } from '@/lib/utils/api';
import { quoteBluexpress, calculatePackageFromOrder } from '@/lib/shipping/bluexpress';

const MAX_SHIPPING_CLP = 15000;
const SHIPPING_TOLERANCE = 0.15;
const FREE_SHIPPING_THRESHOLD = 50000;

const createOrderSchema = z.object({
  items: z.array(z.object({ productId: z.string(), variantId: z.string().optional(), quantity: z.number().int().min(1) })).min(1),
  shippingData: z.object({
    firstName: z.string(), lastName: z.string(), street: z.string(), number: z.string(), apartment: z.string().optional(),
    commune: z.string(), city: z.string(), region: z.string(), phone: z.string(), email: z.string().email(),
  }),
  couponCode: z.string().optional(), shippingService: z.string().optional(), shippingAmount: z.number().min(0).max(MAX_SHIPPING_CLP).optional(), notes: z.string().optional(),
});

async function resolveShippingAmount(params: {
  clientAmount?: number; shippingService?: string; shippingData: z.infer<typeof createOrderSchema>['shippingData']; items: { quantity: number }[]; freeShipping: boolean;
}): Promise<{ amount: number; source: string }> {
  if (params.freeShipping) return { amount: 0, source: 'free' };
  let serverQuotes: { price: number; serviceName: string; serviceCode: string }[] = [];
  try {
    const pkg = calculatePackageFromOrder(params.items.map((i) => ({ quantity: i.quantity, weight: 0.5 })));
    const quotes = await quoteBluexpress({ street: params.shippingData.street, number: params.shippingData.number, apartment: params.shippingData.apartment, commune: params.shippingData.commune, city: params.shippingData.city || params.shippingData.commune, region: params.shippingData.region }, [pkg]);
    serverQuotes = quotes.map((q) => ({ price: Number(q.price), serviceName: q.serviceName, serviceCode: q.serviceCode }));
  } catch { serverQuotes = []; }

  const fallback = 3990;
  if (typeof params.clientAmount !== 'number') return { amount: serverQuotes[0]?.price ?? fallback, source: serverQuotes.length ? 'server-quote' : 'fallback' };
  let matched = serverQuotes[0];
  if (params.shippingService && serverQuotes.length) matched = serverQuotes.find((q) => q.serviceName === params.shippingService || q.serviceCode === params.shippingService || params.shippingService!.toLowerCase().includes(q.serviceCode.toLowerCase())) || matched;
  if (matched && Math.abs(matched.price - params.clientAmount) / Math.max(matched.price, 1) <= SHIPPING_TOLERANCE) {
    return { amount: params.clientAmount, source: 'client-validated' };
  }
  if (params.clientAmount > MAX_SHIPPING_CLP) return { amount: fallback, source: 'capped' };
  if (params.clientAmount > 0 && (params.clientAmount < 1500 || params.clientAmount > 8000)) return { amount: fallback, source: 'out-of-band-fallback' };
  return { amount: params.clientAmount, source: 'client-accepted' };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    // Ocultar checkouts abandonados (PENDING + pago PENDING): solo viven en el carrito
    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        NOT: {
          AND: [{ status: 'PENDING' }, { paymentStatus: 'PENDING' }],
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: { images: { where: { isMain: true }, take: 1 } },
            },
          },
        },
        payment: { select: { status: true, provider: true, paidAt: true, paymentMethod: true } },
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
    const data = createOrderSchema.parse(await req.json());
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, isActive: true }, include: { inventory: true, variants: true, images: { where: { isMain: true }, take: 1 } } });
    if (products.length !== new Set(productIds).size) return badRequest('Algunos productos no están disponibles');

    let subtotal = 0;
    const orderItems: any[] = [];
    for (const item of data.items) {
      const product = products.find((p) => p.id === item.productId)!;
      const hasVariants = product.variants.length > 0;
      if (hasVariants && !item.variantId) return badRequest(`Selecciona una variante para "${product.name}"`);
      const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId && v.isActive) : null;
      if (item.variantId && !variant) return badRequest(`La variante seleccionada de "${product.name}" ya no está disponible`);

      const price = variant ? Number(variant.price) : Number(product.basePrice);
      const stock = variant ? variant.stock : (product.inventory?.stock ?? 0);
      if (product.inventory?.trackStock && stock < item.quantity) return badRequest(`Stock insuficiente para "${product.name}${variant ? ` - ${variant.name}` : ''}"`);
      const lineTotal = price * item.quantity;
      subtotal += lineTotal;
      orderItems.push({
        productId: product.id,
        variantId: variant?.id,
        sku: variant?.sku || product.sku,
        name: variant ? `${product.name} - ${variant.name}` : product.name,
        quantity: item.quantity,
        unitPrice: price,
        totalPrice: lineTotal,
        image: product.images[0]?.url || product.imageUrl,
      });
    }

    let discount = 0;
    if (data.couponCode) {
      const coupon = await prisma.coupon.findFirst({ where: { code: data.couponCode.toUpperCase(), isActive: true } });
      if (coupon) {
        if (coupon.type === 'PERCENTAGE') discount = subtotal * (Number(coupon.value) / 100);
        else discount = Number(coupon.value);
        discount = Math.min(discount, subtotal);
      }
    }

    const freeShipping = subtotal - discount >= FREE_SHIPPING_THRESHOLD;
    const shipping = await resolveShippingAmount({
      clientAmount: data.shippingAmount,
      shippingService: data.shippingService,
      shippingData: data.shippingData,
      items: data.items,
      freeShipping,
    });

    const total = subtotal - discount + shipping.amount;
    const orderNumber = generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: user?.id,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          subtotal,
          discountAmount: discount,
          shippingAmount: shipping.amount,
          total,
          couponCode: data.couponCode?.toUpperCase(),
          notes: data.notes,
          shippingData: data.shippingData,
          guestEmail: user ? undefined : data.shippingData.email,
          guestName: user ? undefined : `${data.shippingData.firstName} ${data.shippingData.lastName}`,
          guestPhone: user ? undefined : data.shippingData.phone,
          items: { create: orderItems },
        },
        include: { items: true, payment: true },
      });

      const variantProductIds = new Set<string>();
      for (const item of data.items) {
        if (item.variantId) {
          const updated = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (updated.count !== 1) throw new Error(`Stock insuficiente para variante ${item.variantId}`);
          const v = await tx.productVariant.findUnique({ where: { id: item.variantId } });
          if (v) variantProductIds.add(v.productId);
        } else {
          const updated = await tx.inventory.updateMany({
            where: { productId: item.productId, stock: { gte: item.quantity } },
            data: { reservedStock: { increment: item.quantity } },
          });
          if (updated.count !== 1) throw new Error(`Stock insuficiente para ${item.productId}`);
        }
      }

      for (const productId of Array.from(variantProductIds)) {
        const activeVariants = await tx.productVariant.findMany({ where: { productId, isActive: true }, select: { stock: true } });
        const aggregateStock = activeVariants.reduce((sum: number, v: { stock: number }) => sum + v.stock, 0);
        await tx.inventory.upsert({ where: { productId }, update: { stock: aggregateStock }, create: { productId, stock: aggregateStock, lowStockThreshold: 5, trackStock: true } });
      }

      if (data.couponCode) await tx.coupon.update({ where: { code: data.couponCode.toUpperCase() }, data: { usedCount: { increment: 1 } } });
      return newOrder;
    });

    return created({ order, shippingSource: shipping.source });
  } catch (error) {
    if (error instanceof z.ZodError) return badRequest('Datos inválidos', error.errors);
    return serverError(error);
  }
}
