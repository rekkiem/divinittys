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

async function loadFromSeller(
  client: MlApiClient,
  limit: number
): Promise<OurProduct[]> {
  const products: OurProduct[] = [];
  let offset = 0;

  while (products.length < limit) {
    const data = await client.searchBySeller(CONFIG.ourSellerId, offset);
    const results: any[] = data.results || [];
    if (!results.length) break;

    for (const r of results) {
      if (products.length >= limit) break;
      const brandAttr = (r.attributes || []).find(
        (a: any) => a.id === 'BRAND' || a.name === 'Marca'
      );
      const gtinAttr = (r.attributes || []).find(
        (a: any) =>
          a.id === 'GTIN' ||
          a.id === 'EAN' ||
          String(a.name || '')
            .toLowerCase()
            .includes('gtin') ||
          String(a.name || '')
            .toLowerCase()
            .includes('ean')
      );

      products.push({
        id: r.id,
        title: r.title,
        sku: `ML-${r.id}`,
        mlItemId: r.id,
        price: r.price,
        brand: brandAttr?.value_name || null,
        gtin: gtinAttr?.value_name || null,
      });
    }

    offset += CONFIG.searchLimit;
    if (results.length < CONFIG.searchLimit) break;
    if (offset >= (data.paging?.total ?? 0)) break;
  }

  return products;
}

async function loadFromPrisma(limit: number): Promise<OurProduct[]> {
  // Import dinámico para no fallar si se corre solo con --source=seller/demo
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
