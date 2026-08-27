import { CONFIG } from '../config';
import type { CompetitorHit, OurProduct } from '../types';
import type { MlApiClient } from '../clients/ml-api';

function normalizeTitle(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeTitle(a).split(' ').filter((w) => w.length > 2));
  const tb = new Set(normalizeTitle(b).split(' ').filter((w) => w.length > 2));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function extractFullCompetitors(
  results: any[],
  our: OurProduct,
  matchedBy: string,
  options: { minTitleSimilarity?: number } = {}
): CompetitorHit[] {
  const hits: CompetitorHit[] = [];
  const minSim = options.minTitleSimilarity ?? 0;

  for (const r of results || []) {
    const logistic = r?.shipping?.logistic_type;
    const sellerId = Number(r?.seller?.id ?? r?.seller_id ?? 0);

    if (logistic !== 'fulfillment') continue;
    if (!sellerId || sellerId === CONFIG.ourSellerId) continue;

    const itemId = String(r.id || r.item_id || '');
    if (!itemId) continue;
    if (our.mlItemId && itemId === String(our.mlItemId)) continue;
    if (our.sku && `ML-${itemId}` === our.sku) continue;

    if (minSim > 0) {
      const sim = titleSimilarity(our.title, String(r.title || r.name || ''));
      if (sim < minSim) continue;
    }

    hits.push({
      itemId,
      title: String(r.title || r.name || our.title),
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
 * Convierte buy_box_winner (shape del resource /products/{id}) en CompetitorHit
 * si es Full y de un seller distinto al nuestro.
 */
function hitFromBuyBoxWinner(
  winner: any,
  our: OurProduct,
  catalogName: string,
  matchedBy: string
): CompetitorHit | null {
  if (!winner) return null;
  const logistic = winner?.shipping?.logistic_type;
  const sellerId = Number(winner?.seller_id ?? winner?.seller?.id ?? 0);
  const itemId = String(winner?.item_id || winner?.id || '');

  if (logistic !== 'fulfillment') return null;
  if (!sellerId || sellerId === CONFIG.ourSellerId) return null;
  if (!itemId || !itemId.startsWith('ML')) return null;
  if (our.mlItemId && itemId === String(our.mlItemId)) return null;

  return {
    itemId,
    title: catalogName || our.title,
    price: Number(winner.price ?? 0),
    currency: String(winner.currency_id || 'CLP'),
    permalink: String(winner.permalink || ''),
    sellerId,
    soldQuantity:
      typeof winner.sold_quantity === 'number'
        ? winner.sold_quantity
        : undefined,
    logisticType: logistic,
    freeShipping: !!winner.shipping?.free_shipping,
    matchedBy,
    ourProductId: our.id,
    ourTitle: our.title,
  };
}

export async function findCompetitorsFallback(
  client: MlApiClient,
  our: OurProduct
): Promise<CompetitorHit[]> {
  const hits: CompetitorHit[] = [];
  const seen = new Set<string>();
  const productIds = new Set<string>();

  const addHit = (h: CompetitorHit | null) => {
    if (!h || seen.has(h.itemId)) return;
    seen.add(h.itemId);
    hits.push(h);
  };

  const addHits = (extracted: CompetitorHit[]) => {
    for (const h of extracted) addHit(h);
  };

  // --- 1) GTIN ---
  const gtin = our.gtin?.replace(/\D/g, '');
  if (gtin && /^\d{8,14}$/.test(gtin)) {
    try {
      const catalog = await client.searchCatalogByIdentifier(gtin);
      for (const r of catalog.results || []) {
        const id = String(r.id || r || '');
        if (id) productIds.add(id);
      }
    } catch (e: any) {
      console.error(`    ✗ catalog GTIN ${gtin}: ${e.message}`);
    }
  }

  // --- 2) catalog_product_id del ítem propio ---
  if (our.mlItemId) {
    try {
      const item = await client.getItem(our.mlItemId);
      if (item?.catalog_product_id) {
        productIds.add(String(item.catalog_product_id));
      }
      const g = (item?.attributes || []).find(
        (a: any) =>
          a.id === 'GTIN' ||
          a.id === 'EAN' ||
          /gtin|ean/i.test(String(a.name || ''))
      );
      const digits = String(g?.value_name || '').replace(/\D/g, '');
      if (/^\d{8,14}$/.test(digits)) {
        try {
          const catalog = await client.searchCatalogByIdentifier(digits);
          for (const r of catalog.results || []) {
            const id = String(r.id || r || '');
            if (id) productIds.add(id);
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }

  // --- 3) Búsqueda por NOMBRE en catálogo ---
  for (const q of buildNameQueries(our)) {
    try {
      const catalog = await client.searchCatalogByQuery(q, 8);
      for (const r of catalog.results || []) {
        const id = String(r.id || r || '');
        const pname = String(r.name || r.title || '');
        if (pname && titleSimilarity(our.title, pname) < 0.22) continue;
        if (id) productIds.add(id);
      }
    } catch (e: any) {
      console.error(`    ✗ catalog q="${q.slice(0, 40)}": ${e.message}`);
    }
  }

  // --- 4) Expandir padres → hijos y leer buy_box_winner ---
  const toVisit = Array.from(productIds).slice(0, 15);
  const visited = new Set<string>();

  for (const productId of toVisit) {
    await collectFromCatalogProduct(
      client,
      productId,
      our,
      addHit,
      addHits,
      visited,
      0
    );
  }

  // --- 5) Site search si no está bloqueado ---
  if (!hits.length && !client.siteSearchBlocked && our.title) {
    try {
      const data = await client.search(our.title.slice(0, 80), 0);
      addHits(
        extractFullCompetitors(data.results || [], our, 'title', {
          minTitleSimilarity: 0.3,
        })
      );
    } catch {
      /* blocked */
    }
  }

  return hits;
}

async function collectFromCatalogProduct(
  client: MlApiClient,
  productId: string,
  our: OurProduct,
  addHit: (h: CompetitorHit | null) => void,
  addHits: (h: CompetitorHit[]) => void,
  visited: Set<string>,
  depth: number
): Promise<void> {
  if (visited.has(productId) || depth > 2) return;
  visited.add(productId);

  let product: any;
  try {
    product = await client.getCatalogProduct(productId);
  } catch {
    return;
  }

  const catalogName = String(product?.name || '');

  // buy_box_winner directo (fuente principal sin site search)
  addHit(
    hitFromBuyBoxWinner(
      product?.buy_box_winner,
      our,
      catalogName,
      'name_catalog_buybox'
    )
  );

  if (Array.isArray(product?.buy_box_winners)) {
    for (const w of product.buy_box_winners) {
      addHit(hitFromBuyBoxWinner(w, our, catalogName, 'name_catalog_buybox'));
    }
  }

  // Ítems listados en el producto (si vienen)
  const itemIds = extractItemIdsFromProduct(product);
  if (itemIds.length) {
    for (let i = 0; i < itemIds.length; i += 20) {
      const batch = itemIds.slice(i, i + 20);
      try {
        const items = await client.getItems(batch);
        addHits(
          extractFullCompetitors(items, our, 'name_catalog_items', {
            minTitleSimilarity: 0.25,
          })
        );
      } catch {
        /* ignore batch */
      }
    }
  }

  // Productos padre → hijos más específicos (tienen buy box real)
  const children: string[] = Array.isArray(product?.children_ids)
    ? product.children_ids.map(String).slice(0, 8)
    : [];
  for (const childId of children) {
    await collectFromCatalogProduct(
      client,
      childId,
      our,
      addHit,
      addHits,
      visited,
      depth + 1
    );
  }
}

function extractItemIdsFromProduct(product: any): string[] {
  const ids = new Set<string>();
  const push = (c: unknown) => {
    if (c == null) return;
    const s = String(c);
    if (/^MLC\d{6,}$/i.test(s)) ids.add(s);
  };

  push(product?.buy_box_winner?.item_id);
  if (Array.isArray(product?.buy_box_winners)) {
    for (const w of product.buy_box_winners) push(w?.item_id);
  }
  if (Array.isArray(product?.items)) {
    for (const it of product.items) {
      push(it?.item_id);
      push(it?.id);
    }
  }

  const walk = (obj: any, depth: number) => {
    if (!obj || depth > 3) return;
    if (typeof obj === 'string' && /^MLC\d{6,}$/i.test(obj)) {
      ids.add(obj);
      return;
    }
    if (Array.isArray(obj)) {
      for (const x of obj.slice(0, 25)) walk(x, depth + 1);
      return;
    }
    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        if (/item_id/i.test(k)) push(v);
        else if (typeof v === 'object') walk(v, depth + 1);
      }
    }
  };
  walk(product, 0);

  return Array.from(ids).slice(0, 40);
}

function buildNameQueries(our: OurProduct): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (q: string) => {
    const k = q.trim().toLowerCase();
    if (k.length < 6 || seen.has(k)) return;
    seen.add(k);
    out.push(q.trim().slice(0, 90));
  };

  const title = (our.title || '').trim();
  if (title) push(title);

  if (our.brand && title) {
    const words = normalizeTitle(title)
      .split(' ')
      .filter((w) => w.length > 2 && w !== normalizeTitle(our.brand || ''))
      .slice(0, 5);
    if (words.length) push(`${our.brand} ${words.join(' ')}`);
  } else if (our.brand && our.model) {
    push(`${our.brand} ${our.model}`);
  }

  const cleaned = title
    .replace(/\b\d+\s*(ml|g|gr|kg|l)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 8 && cleaned !== title) push(cleaned);

  return out.slice(0, 4);
}
