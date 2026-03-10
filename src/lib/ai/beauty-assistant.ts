import OpenAI from 'openai';
import { prisma } from '../prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BEAUTY_SYSTEM_PROMPT = `Eres LUNA, la asistente de belleza virtual de DIVINITTYS, una tienda especializada en productos de belleza profesional en Chile. 

Tu personalidad:
- Experta en belleza, colorimetría capilar y cuidado del cabello
- Amigable, empática y profesional
- Hablas en español latinoamericano
- Das recomendaciones específicas de productos cuando es apropiado
- Siempre preguntas sobre las necesidades específicas del cliente

Conoces profundamente:
- Tipos de cabello (liso, ondulado, rizado, afro)
- Colorimetría y técnicas de coloración
- Tratamientos capilares (keratina, botox capilar, nutrición)
- Marcas profesionales (Wella, L'Oréal, Schwarzkopf, Kerastase, Redken)
- Rutinas de cuidado capilar

Cuando un cliente describe su cabello o necesidad, recomienda productos específicos de nuestro catálogo cuando sea posible.
Si no tienes información suficiente, pregunta más detalles.
Responde siempre de forma concisa pero útil (máximo 200 palabras).`;

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function chatWithBeautyAssistant(
  messages: ChatMessage[],
  userId?: string
): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: BEAUTY_SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'Lo siento, no pude procesar tu consulta.';
  } catch (error) {
    console.error('OpenAI error:', error);
    return 'Lo siento, el asistente no está disponible en este momento. Por favor contáctanos directamente.';
  }
}

export type HairDiagnosisInput = {
  hairType: string;        // liso, ondulado, rizado, muy_rizado
  hairTexture: string;     // fino, normal, grueso
  hairCondition: string;   // sano, dañado, muy_dañado, quimicamente_tratado
  currentColor: string;    // natural, teñido, decolorado, con_canas
  concerns: string[];      // sequedad, frizz, puntas_abiertas, caida, falta_volumen
  desiredTreatment: string[]; // hidratacion, nutricion, keratina, coloracion, crecimiento
  budget: string;          // bajo, medio, alto
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
  const prompt = `
Diagnóstico capilar del cliente:
- Tipo de cabello: ${input.hairType}
- Textura: ${input.hairTexture}
- Condición: ${input.hairCondition}
- Color actual: ${input.currentColor}
- Preocupaciones: ${input.concerns.join(', ')}
- Tratamientos deseados: ${input.desiredTreatment.join(', ')}
- Presupuesto: ${input.budget}

Productos disponibles en DIVINITTYS:
${availableProducts.slice(0, 20).map(p => `- ${p.name} (${p.category}, ${p.brand}, $${p.price})`).join('\n')}

Genera un diagnóstico capilar personalizado en JSON con:
{
  "diagnosis": "diagnóstico en 2-3 oraciones",
  "routine": ["paso 1", "paso 2", "paso 3", "paso 4"],
  "recommendedProductNames": ["nombre producto 1", "nombre producto 2", "nombre producto 3"],
  "tips": ["tip 1", "tip 2", "tip 3"]
}
Responde SOLO el JSON, sin markdown.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: BEAUTY_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 600,
      temperature: 0.5,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    const recommendedProducts = availableProducts.filter((p) =>
      (parsed.recommendedProductNames || []).some((name: string) =>
        p.name.toLowerCase().includes(name.toLowerCase())
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
      routine: ['Lavar con champú suave', 'Aplicar acondicionador', 'Usar mascarilla 1x semana', 'Aplicar sérum reparador'],
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
  // Get viewed/purchased products for context
  const userHistory = await prisma.order.findMany({
    where: { userId, paymentStatus: 'PAID' },
    include: { items: { include: { product: { include: { category: true } } } } },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  const purchasedCategories = userHistory
    .flatMap((o) => o.items.map((i) => i.product.category.name))
    .slice(0, 10);

  if (purchasedCategories.length === 0) {
    // Return featured products for new users
    const featured = await prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      take: 6,
      select: { id: true },
    });
    return featured.map((p) => p.id);
  }

  // Find similar products
  const recommended = await prisma.product.findMany({
    where: {
      isActive: true,
      category: { name: { in: purchasedCategories } },
      NOT: {
        id: { in: context.viewedProductIds || [] },
      },
    },
    take: 8,
    select: { id: true },
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
  });

  return recommended.map((p) => p.id);
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
  const prompt = `
Soy una colorista profesional. Cliente quiere:
- Color actual: ${params.currentColor}
- Color deseado: ${params.desiredColor}
- Condición del cabello: ${params.hairCondition}
- Técnica: ${params.technique || 'no especificada'}

Genera recomendación en JSON:
{
  "recommendation": "explicación del proceso en 2-3 oraciones",
  "products": ["producto recomendado 1", "producto 2", "producto 3"],
  "steps": ["paso 1", "paso 2", "paso 3"],
  "warnings": ["advertencia 1 si aplica"]
}
Responde SOLO el JSON.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: BEAUTY_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.4,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch {
    return {
      recommendation: 'Para este cambio de color, recomendamos trabajar con un profesional.',
      products: ['Tintura profesional', 'Oxidante', 'Mascarilla post-coloración'],
      steps: ['Realizar prueba de alergia', 'Aplicar coloración', 'Hidratar post-proceso'],
      warnings: ['Consultar con colorista profesional para cambios extremos'],
    };
  }
}
