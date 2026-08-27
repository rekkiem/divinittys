import { CONFIG } from '../config';
import type { CompetitorHit, OurProduct } from '../types';
import type { MlApiClient } from '../clients/ml-api';

/**
 * Extrae de resultados de search solo listings Full de terceros.
 * Acepta tanto shape de /sites/.../search (results[]) como ítems ya hidratados.
 */
export function extractFullCompetitors(
  results: any[],
  our: OurProduct,
  matchedBy: string
): CompetitorHit[] {
  const hits: CompetitorHit[] = [];

  for (const r of results || []) {
    const logistic = r?.shipping?.logistic_type;
    const sellerId = Number(r?.seller?.id ?? r?.seller_id ?? 0);

    if (logistic !== 'fulfillment') continue;
    if (!sellerId || sellerId === CONFIG.ourSellerId) continue;

    if (our.mlItemId && r.id === our.mlItemId) continue;
    if (our.sku && `ML-${r.id}` === our.sku) continue;

    hits.push({
      itemId: String(r.id),
      title: String(r.title || ''),
      price: Number(r.price ?? 0),
      currency: String(r.currency_id || 'CLP'),
      permalink: String(r.permalink || ''),
      sellerId,
      sellerNickname: r.seller?.nickname
        ? String(r.seller.nickname)
        : undefined,
      soldQuantity:
        typeof r.sold_quantity === 'number' ? r.sold_quantity : undefined,
      logisticType: logistic,
      freeShipping: !!r.shipping?.free_shipping,
      matchedBy,
      ourProductId: our.id,
      ourTitle: our.title,
    });
  }

  return hits;
}

/**
 * Cuando /sites/.../search está bloqueado (403), intenta:
 * 1) products/search por GTIN
 * 2) detalle de productos de catálogo y, si hay buy_box / items asociados, hidratar ítems
 * 3) filtrar por logistic_type fulfillment y seller ajeno
 */
export async function findCompetitorsFallback(
  client: MlApiClient,
  our: OurProduct
): Promise<CompetitorHit[]> {
  const hits: CompetitorHit[] = [];
  const seen = new Set<string>();

  const gtin = our.gtin?.replace(/\D/g, '');
  if (gtin && /^\d{8,14}$/.test(gtin)) {
    try {
      const catalog = await client.searchCatalogByIdentifier(gtin);
      const productIds: string[] = (catalog.results || [])
        .map((r: any) => r.id || r)
        .filter(Boolean)
        .map(String)
        .slice(0, 5);

      for (const productId of productIds) {
        const itemIds = await resolveMarketplaceItemIds(client, productId);
        if (!itemIds.length) continue;

        for (let i = 0; i < itemIds.length; i += 20) {
          const batch = itemIds.slice(i, i + 20);
          const items = await client.getItems(batch);
          const extracted = extractFullCompetitors(items, our, 'gtin_catalog');
          for (const h of extracted) {
            if (seen.has(h.itemId)) continue;
            seen.add(h.itemId);
            hits.push(h);
          }
        }
      }
    } catch (e: any) {
      console.error(`    ✗ catalog GTIN ${gtin}: ${e.message}`);
    }
  }

  // Si no hay GTIN, intentar título vía site search solo si no está bloqueado
  if (!hits.length && !client.siteSearchBlocked && our.title) {
    try {
      const data = await client.search(our.title.slice(0, 80), 0);
      const extracted = extractFullCompetitors(
        data.results || [],
        our,
        'title'
      );
      for (const h of extracted) {
        if (seen.has(h.itemId)) continue;
        seen.add(h.itemId);
        hits.push(h);
      }
    } catch {
      /* ya marcado blocked o sin resultados */
    }
  }

  return hits;
}

async function resolveMarketplaceItemIds(
  client: MlApiClient,
  productId: string
): Promise<string[]> {
  try {
    const product = await client.getCatalogProduct(productId);
    const ids = new Set<string>();

    // Varias formas según versión de API / país
    const candidates = [
      product?.buy_box_winner?.item_id,
      product?.buy_box_winner?.id,
      ...(Array.isArray(product?.buy_box_winners)
        ? product.buy_box_winners.map((w: any) => w.item_id || w.id)
        : []),
      ...(Array.isArray(product?.items)
        ? product.items.map((it: any) => it.item_id || it.id)
        : []),
    ];

    for (const c of candidates) {
      if (c && String(c).startsWith('ML')) ids.add(String(c));
    }

    // Algunos productos traen permalinks o children; sin más endpoints públicos
    // nos quedamos con lo disponible en el resource /products/{id}
    return Array.from(ids).slice(0, 40);
  } catch {
    return [];
  }
}
