import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { chatWithBeautyAssistant, generateHairDiagnosis, generateTinturaRecommendation, generateProductRecommendations } from '@/lib/ai/beauty-assistant';
import { ok, badRequest, serverError } from '@/lib/utils/api';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const body = await req.json();

    // Support direct message format (no action param)
    if (!action && body.message) {
      const user = await getAuthUser(req);
      const msgs = [
        ...(body.history || []),
        { role: 'user' as const, content: body.message },
      ];
      const reply = await chatWithBeautyAssistant(msgs, user?.id);
      return ok({ reply });
    }

    // Support diagnosis type from HairDiagnosisForm
    if (!action && body.type === 'diagnosis') {
      const answers = body.answers || {};
      const products = await prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true, name: true, slug: true, basePrice: true,
          category: { select: { name: true } },
          brand: { select: { name: true } },
          images: { where: { isMain: true }, take: 1, select: { url: true } },
        },
        take: 30,
        orderBy: { isFeatured: 'desc' },
      });

      const diagnosisInput = {
        hairType: answers.hairType || 'no especificado',
        hairTexture: 'normal',
        hairCondition: answers.condition || 'normal',
        currentColor: answers.chemical || 'natural',
        concerns: [answers.concern || 'hidratacion'],
        desiredTreatment: ['hidratacion'],
        budget: 'medio',
      };

      const diagnosis = await generateHairDiagnosis(
        diagnosisInput,
        products.map((p) => ({
          name: p.name,
          category: p.category.name,
          price: Number(p.basePrice),
          brand: p.brand?.name || 'Sin marca',
        }))
      );

      const enriched = products
        .filter((p) => diagnosis.recommendedProducts.some((r) => r.name === p.name))
        .slice(0, 4)
        .map((p) => ({ ...p, basePrice: Number(p.basePrice), images: p.images }));

      return ok({
        advice: diagnosis.diagnosis,
        products: enriched.length > 0 ? enriched : products.slice(0, 4).map((p) => ({ ...p, basePrice: Number(p.basePrice) })),
      });
    }

    // ---- Beauty Chat Assistant ----
    if (action === 'chat') {
      const { messages } = z.object({
        messages: z.array(z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string(),
        })).min(1),
      }).parse(body);

      const user = await getAuthUser(req);
      const reply = await chatWithBeautyAssistant(messages, user?.id);

      return ok({ reply });
    }

    // ---- Hair Diagnosis ----
    if (action === 'hair-diagnosis') {
      const input = z.object({
        hairType: z.string(),
        hairTexture: z.string(),
        hairCondition: z.string(),
        currentColor: z.string(),
        concerns: z.array(z.string()),
        desiredTreatment: z.array(z.string()),
        budget: z.string().default('medio'),
      }).parse(body);

      // Get relevant products
      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          category: {
            slug: {
              in: ['cuidado-capilar', 'tratamientos', 'keratina', 'coloracion'],
            },
          },
        },
        select: {
          id: true,
          name: true,
          basePrice: true,
          category: { select: { name: true } },
          brand: { select: { name: true } },
          images: { where: { isMain: true }, take: 1, select: { url: true } },
        },
        take: 40,
      });

      const diagnosis = await generateHairDiagnosis(
        input,
        products.map((p) => ({
          name: p.name,
          category: p.category.name,
          price: Number(p.basePrice),
          brand: p.brand?.name || 'Sin marca',
        }))
      );

      // Save hair profile for logged-in users
      const user = await getAuthUser(req);
      if (user) {
        await prisma.hairProfile.upsert({
          where: { userId: user.id },
          update: {
            hairType: input.hairType,
            hairTexture: input.hairTexture,
            hairCondition: input.hairCondition,
            currentColor: input.currentColor,
            concerns: input.concerns,
            desiredTreatment: input.desiredTreatment,
          },
          create: {
            userId: user.id,
            hairType: input.hairType,
            hairTexture: input.hairTexture,
            hairCondition: input.hairCondition,
            currentColor: input.currentColor,
            concerns: input.concerns,
            desiredTreatment: input.desiredTreatment,
          },
        });
      }

      // Enrich with full product data
      const enrichedProducts = await prisma.product.findMany({
        where: {
          isActive: true,
          name: {
            in: diagnosis.recommendedProducts.map((p) => p.name),
          },
        },
        include: {
          images: { where: { isMain: true }, take: 1 },
          brand: { select: { name: true } },
        },
        take: 6,
      });

      return ok({
        ...diagnosis,
        recommendedProducts: enrichedProducts,
      });
    }

    // ---- Tintura Recommender ----
    if (action === 'tintura') {
      const input = z.object({
        currentColor: z.string(),
        desiredColor: z.string(),
        hairCondition: z.string(),
        technique: z.string().optional(),
      }).parse(body);

      const recommendation = await generateTinturaRecommendation(input);

      // Find matching tintura products
      const tinturas = await prisma.product.findMany({
        where: {
          isActive: true,
          category: { slug: 'coloracion' },
        },
        include: {
          images: { where: { isMain: true }, take: 1 },
          brand: { select: { name: true } },
          inventory: { select: { stock: true } },
        },
        take: 8,
        orderBy: { isFeatured: 'desc' },
      });

      return ok({ ...recommendation, products: tinturas });
    }

    // ---- Product Recommendations ----
    if (action === 'recommendations') {
      const user = await getAuthUser(req);
      const context = z.object({
        viewedProductIds: z.array(z.string()).optional(),
        cartProductIds: z.array(z.string()).optional(),
      }).parse(body);

      if (!user) {
        // Return featured for guests
        const featured = await prisma.product.findMany({
          where: { isActive: true, isFeatured: true },
          include: {
            images: { where: { isMain: true }, take: 1 },
            brand: { select: { name: true } },
            inventory: { select: { stock: true } },
          },
          take: 8,
          orderBy: { createdAt: 'desc' },
        });
        return ok({ products: featured });
      }

      const productIds = await generateProductRecommendations(user.id, context);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        include: {
          images: { where: { isMain: true }, take: 1 },
          brand: { select: { name: true } },
          inventory: { select: { stock: true } },
        },
      });

      return ok({ products });
    }

    return badRequest('Acción no válida');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest('Datos inválidos', error.errors);
    }
    return serverError(error);
  }
}
