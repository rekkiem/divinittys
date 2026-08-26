import { CONFIG } from '../config';
import type { CompetitorHit, OurProduct } from '../types';

/**
 * Extrae de resultados de search solo listings Full de terceros.
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

    // Evitar el propio ítem si aparece por coincidencia de título
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
