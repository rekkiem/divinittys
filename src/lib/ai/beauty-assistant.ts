/**
 * LUNA — Asistente de belleza DIVINITTYS
 * Provider: Google Gemini (gemini-3.5-flash-lite)
 * Env: GEMINI_API_KEY  |  opcional: GEMINI_MODEL
 */
import { prisma } from '../prisma';

// 2.5-flash-lite ya no está disponible para cuentas nuevas (404).
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const BEAUTY_SYSTEM_PROMPT = `Eres LUNA, la asistente de belleza virtual de DIVINITTYS, tienda de productos de belleza profesional en Chile.

Personalidad:
- Experta en belleza, colorimetría y cuidado del cabello
- Amigable, empática y profesional
- Español de Chile / latinoamericano
- Respuestas claras, máximo ~180 palabras

Reglas de venta:
- Recomienda SOLO productos de la lista CATALOGO_ACTUAL que te entregamos en cada mensaje
- Si mencionas un producto, incluye su nombre exacto y precio en CLP
- Si el cliente quiere comprar, indícale la ruta /productos/{slug} cuando esté disponible
- No inventes productos, precios ni stock
- Si no hay match en el catálogo, dilo y sugiere alternativas cercanas del listado

Postventa (si preguntan por pedido):
- Pide número de pedido o email
- Indica que pueden revisar en /cuenta o escribir a soporte
- No inventes estados de envío

Conocimiento general: tipos de cabello, colorimetría, keratina, rutinas, marcas profesionales.`;

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type CatalogItem = {
  id: string;
  name: string;
  slug: string;
  price: number;
  brand: string;
  category: string;
};

async function loadCatalogContext(userMessage: string): Promise<CatalogItem[]> {
  const words = userMessage
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6);

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR:
        words.length > 0
          ? [
              ...words.map((w) => ({ name: { contains: w, mode: 'insensitive' as const } })),
              ...words.map((w) => ({ tags: { has: w } })),
              { isFeatured: true },
            ]
          : [{ isFeatured: true }, { isOnSale: true }],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      basePrice: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
    },
    take: 12,
    orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
  });

  if (products.length > 0) {
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.basePrice),
      brand: p.brand?.name || 'Sin marca',
      category: p.category.name,
    }));
  }

  const fallback = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      basePrice: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
    },
    take: 10,
    orderBy: { isFeatured: 'desc' },
  });

  return fallback.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.basePrice),
    brand: p.brand?.name || 'Sin marca',
    category: p.category.name,
  }));
}

function formatCatalogBlock(items: CatalogItem[]): string {
  if (!items.length) return 'CATALOGO_ACTUAL: (vacío por ahora)';
  const lines = items.map(
    (p) =>
      `- ${p.name} | ${p.brand} | ${p.category} | $${p.price} CLP | /productos/${p.slug}`
  );
  return `CATALOGO_ACTUAL (usa solo estos productos):\n${lines.join('\n')}`;
}

async function callGemini(
  system: string,
  messages: ChatMessage[],
  maxTokens = 500
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  if (contents.length && contents[0].role === 'model') {
    contents.unshift({ role: 'user', parts: [{ text: '(inicio de conversación)' }] });
  }

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('Gemini error', res.status, errText.slice(0, 500));
    throw new Error(`GEMINI_HTTP_${res.status}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') ||
    '';

  if (!text.trim()) {
    throw new Error('GEMINI_EMPTY_RESPONSE');
  }

  return text.trim();
}

export async function chatWithBeautyAssistant(
  messages: ChatMessage[],
  _userId?: string
): Promise<string> {
  try {
    const lastUser =
      [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const catalog = await loadCatalogContext(lastUser);
    const system = `${BEAUTY_SYSTEM_PROMPT}\n\n${formatCatalogBlock(catalog)}`;
    const recent = messages.slice(-12);

    return await callGemini(system, recent, 450);
  } catch (error: any) {
    console.error('Luna chat error:', error?.message || error);
    if (error?.message === 'MISSING_GEMINI_API_KEY') {
      return 'LUNA aún no está configurada (falta GEMINI_API_KEY). El equipo ya fue notificado.';
    }
    return 'Lo siento, el asistente no está disponible en este momento. Por favor intenta de nuevo en unos minutos o contáctanos por WhatsApp/soporte.';
  }
}

export type HairDiagnosisInput = {
  hairType: string;
  hairTexture: string;
  hairCondition: string;
  currentColor: string;
  concerns: string[];
  desiredTreatment: string[];
  budget: string;
};

export async function generateHairDiagnosis(
  input: HairDiagnosisInput,
  availableProducts: { name: string; category: string; price: number; brand: string }[]
): Promise<{
  diagnosis: string;
  routine: string[];
  recommendedProducts: typeof availableProducts;
  tips: string[];
}> {
  const prompt = `Diagnóstico capilar del cliente:
- Tipo: ${input.hairType}
- Textura: ${input.hairTexture}
- Condición: ${input.hairCondition}
- Color actual: ${input.currentColor}
- Preocupaciones: ${input.concerns.join(', ')}
- Tratamientos deseados: ${input.desiredTreatment.join(', ')}
- Presupuesto: ${input.budget}

Productos disponibles:
${availableProducts
  .slice(0, 20)
  .map((p) => `- ${p.name} (${p.category}, ${p.brand}, $${p.price})`)
  .join('\n')}

Responde SOLO JSON válido (sin markdown):
{
  "diagnosis": "2-3 oraciones",
  "routine": ["paso 1", "paso 2", "paso 3", "paso 4"],
  "recommendedProductNames": ["nombre 1", "nombre 2", "nombre 3"],
  "tips": ["tip 1", "tip 2", "tip 3"]
}`;

  try {
    const content = await callGemini(
      BEAUTY_SYSTEM_PROMPT,
      [{ role: 'user', content: prompt }],
      600
    );
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);

    const recommendedProducts = availableProducts.filter((p) =>
      (parsed.recommendedProductNames || []).some((name: string) =>
        p.name.toLowerCase().includes(String(name).toLowerCase())
      )
    );

    return {
      diagnosis: parsed.diagnosis || 'Tu cabello necesita atención personalizada.',
      routine: parsed.routine || [],
      recommendedProducts: recommendedProducts.slice(0, 6),
      tips: parsed.tips || [],
    };
  } catch (error) {
    console.error('Hair diagnosis error:', error);
    return {
      diagnosis: 'Basado en tu perfil, te recomendamos comenzar con una rutina de hidratación.',
      routine: [
        'Lavar con champú suave',
        'Aplicar acondicionador',
        'Usar mascarilla 1x semana',
        'Aplicar sérum reparador',
      ],
      recommendedProducts: availableProducts.slice(0, 3),
      tips: ['Evita el calor excesivo', 'Protege del sol', 'Hidrata regularmente'],
    };
  }
}

export async function generateProductRecommendations(
  userId: string,
  context: {
    viewedProductIds?: string[];
    cartProductIds?: string[];
    searchHistory?: string[];
  }
): Promise<string[]> {
  const userHistory = await prisma.order.findMany({
    where: { userId, paymentStatus: 'PAID' },
    include: { items: { include: { product: { include: { category: true } } } } },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  const purchasedCategories = userHistory
    .flatMap((o: any) => o.items.map((i: any) => i.product.category.name))
    .slice(0, 10);

  if (purchasedCategories.length === 0) {
    const featured = await prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      take: 6,
      select: { id: true },
    });
    return featured.map((p: any) => p.id);
  }

  const recommended = await prisma.product.findMany({
    where: {
      isActive: true,
      category: { name: { in: purchasedCategories } },
      NOT: { id: { in: context.viewedProductIds || [] } },
    },
    take: 8,
    select: { id: true },
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
  });

  return recommended.map((p: any) => p.id);
}

export async function generateTinturaRecommendation(params: {
  currentColor: string;
  desiredColor: string;
  hairCondition: string;
  technique?: string;
}): Promise<{
  recommendation: string;
  products: string[];
  steps: string[];
  warnings: string[];
}> {
  const prompt = `Colorista profesional. Cliente:
- Color actual: ${params.currentColor}
- Color deseado: ${params.desiredColor}
- Condición: ${params.hairCondition}
- Técnica: ${params.technique || 'no especificada'}

Responde SOLO JSON:
{
  "recommendation": "2-3 oraciones",
  "products": ["p1", "p2", "p3"],
  "steps": ["paso 1", "paso 2", "paso 3"],
  "warnings": ["advertencia si aplica"]
}`;

  try {
    const content = await callGemini(
      BEAUTY_SYSTEM_PROMPT,
      [{ role: 'user', content: prompt }],
      500
    );
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    return {
      recommendation: 'Para este cambio de color, recomendamos trabajar con un profesional.',
      products: ['Tintura profesional', 'Oxidante', 'Mascarilla post-coloración'],
      steps: ['Prueba de alergia', 'Aplicar coloración', 'Hidratar post-proceso'],
      warnings: ['Consultar colorista para cambios extremos'],
    };
  }
}
