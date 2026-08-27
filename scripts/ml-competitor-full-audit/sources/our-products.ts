import { CONFIG } from '../config';
import type { OurProduct } from '../types';
import type { MlApiClient } from '../clients/ml-api';

export type ProductSource = 'demo' | 'seller' | 'prisma';

export async function loadOurProducts(
  source: ProductSource,
  client: MlApiClient,
  options: { limit?: number } = {}
): Promise<OurProduct[]> {
  const limit = options.limit ?? 100;

  if (source === 'demo') {
    return [
      {
        id: 'demo-1',
        title: 'Shampoo Capilar Reparador 500ml',
        brand: 'Davines',
        sku: 'SHP-500-DEMO',
        gtin: null,
        price: 15990,
      },
      {
        id: 'demo-2',
        title: 'Olaplex No.3 Hair Perfector',
        brand: 'Olaplex',
        model: 'No.3',
        sku: 'OLX-N3-DEMO',
        gtin: null,
        price: 24990,
      },
    ];
  }

  if (source === 'seller') {
    return loadFromSeller(client, limit);
  }

  if (source === 'prisma') {
    return loadFromPrisma(limit);
  }

  throw new Error(`Fuente desconocida: ${source}`);
}

/**
 * Carga publicaciones activas del seller vía API PRIVADA:
 *   GET /users/{sellerId}/items/search  → ids
 *   GET /items?ids=...                  → detalle (título, attrs, precio)
 *
 * No usa /sites/MLC/search (403 PolicyAgent en muchas apps).
 */
async function loadFromSeller(
  client: MlApiClient,
  limit: number
): Promise<OurProduct[]> {
  const products: OurProduct[] = [];
  let offset = 0;
  const pageSize = Math.min(CONFIG.searchLimit, 50);

  while (products.length < limit) {
    const data = await client.searchSellerItems(
      CONFIG.ourSellerId,
      offset,
      pageSize
    );
    const ids: string[] = (data.results || []).map(String);
    if (!ids.length) break;

    // Multiget de a 20 (límite habitual ML)
    for (let i = 0; i < ids.length && products.length < limit; i += 20) {
      const batch = ids.slice(i, i + 20);
      const items = await client.getItems(batch);
      for (const item of items) {
        if (products.length >= limit) break;
        products.push(mapItemToOurProduct(item));
      }
    }

    offset += pageSize;
    const total = data.paging?.total ?? 0;
    if (offset >= total) break;
    if (ids.length < pageSize) break;
  }

  return products;
}

function mapItemToOurProduct(item: any): OurProduct {
  const attrs: any[] = item.attributes || [];
  const brandAttr = attrs.find(
    (a) => a.id === 'BRAND' || a.name === 'Marca'
  );
  const gtinAttr = attrs.find(
    (a) =>
      a.id === 'GTIN' ||
      a.id === 'EAN' ||
      a.id === 'UPC' ||
      /gtin|ean|upc/i.test(String(a.name || ''))
  );
  const modelAttr = attrs.find(
    (a) => a.id === 'MODEL' || /modelo|model/i.test(String(a.name || ''))
  );

  return {
    id: String(item.id),
    title: String(item.title || ''),
    sku: `ML-${item.id}`,
    mlItemId: String(item.id),
    price: Number(item.price ?? 0),
    brand: brandAttr?.value_name || null,
    model: modelAttr?.value_name || null,
    gtin: gtinAttr?.value_name
      ? String(gtinAttr.value_name).replace(/\D/g, '') || null
      : null,
  };
}

async function loadFromPrisma(limit: number): Promise<OurProduct[]> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.product.findMany({
      where: {
        isActive: true,
        sku: { startsWith: 'ML-' },
      },
      include: {
        brand: true,
        attributes: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return rows.map((p) => {
      const gtinAttr = p.attributes.find((a) =>
        /gtin|ean|upc/i.test(a.name)
      );
      const modelAttr = p.attributes.find((a) =>
        /model|modelo/i.test(a.name)
      );
      const mlItemId = p.sku.replace(/^ML-/i, '');

      return {
        id: p.id,
        title: p.name,
        sku: p.sku,
        mlItemId: mlItemId.startsWith('MLC') ? mlItemId : null,
        brand: p.brand?.name ?? null,
        model: modelAttr?.value ?? null,
        gtin: gtinAttr?.value ?? null,
        price: Number(p.basePrice),
      } satisfies OurProduct;
    });
  } finally {
    await prisma.$disconnect();
  }
}
