import { CONFIG } from '../config';
import type { CompetitorHit, OurProduct } from '../types';
import type { MlApiClient } from '../clients/ml-api';

/** Normaliza texto para comparar títulos. */
function normalizeTitle(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Similitud simple por tokens (Jaccard).
 * Umbral ~0.35 suele filtrar ruido sin exigir match exacto.
 */
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

    if (our.mlItemId && String(r.id) === String(our.mlItemId)) continue;
    if (our.sku && `ML-${r.id}` === our.sku) continue;

    if (minSim > 0) {
      const sim = titleSimilarity(our.title, String(r.title || ''));
      if (sim < minSim) continue;
    }

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
 * Fallback cuando /sites/.../search está bloqueado:
 * 1) GTIN → products/search?product_identifier=
 * 2) catalog_product_id del ítem propio (si se puede leer)
 * 3) products/search?q= nombre / marca+nombre  (búsqueda por nombre)
 * 4) Hidratar ítems y filtrar Full + seller ajeno + similitud de título
 */
export async function findCompetitorsFallback(
  client: MlApiClient,
  our: OurProduct
): Promise<CompetitorHit[]> {
  const hits: CompetitorHit[] = [];
  const seen = new Set<string>();
  const productIds = new Set<string>();

  const addHits = (extracted: CompetitorHit[]) => {
    for (const h of extracted) {
      if (seen.has(h.itemId)) continue;
      seen.add(h.itemId);
      hits.push(h);
    }
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
      const cpid = item?.catalog_product_id;
      if (cpid) productIds.add(String(cpid));
      // GTIN a veces viene en el detalle aunque no en el multiget previo
      if (!gtin) {
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
      }
    } catch {
      /* ítem no legible */
    }
  }

  // --- 3) Búsqueda por NOMBRE en catálogo (sin GTIN) ---
  const nameQueries = buildNameQueries(our);
  for (const q of nameQueries) {
    try {
      const catalog = await client.searchCatalogByQuery(q, 10);
      for (const r of catalog.results || []) {
        const id = String(r.id || r || '');
        // Preferir productos cuyo nombre se parezca al nuestro
        const pname = String(r.name || r.title || '');
        if (pname && titleSimilarity(our.title, pname) < 0.25) continue;
        if (id) productIds.add(id);
      }
    } catch (e: any) {
      console.error(`    ✗ catalog q="${q.slice(0, 40)}": ${e.message}`);
    }
  }

  // --- Resolver ítems de marketplace y filtrar Full ---
  const ids = Array.from(productIds).slice(0, 12);
  for (const productId of ids) {
    const itemIds = await resolveMarketplaceItemIds(client, productId);
    if (!itemIds.length) continue;

    for (let i = 0; i < itemIds.length; i += 20) {
      const batch = itemIds.slice(i, i + 20);
      const items = await client.getItems(batch);
      // Por nombre exigimos algo de similitud; por GTIN/catalog id del propio, umbral más bajo
      const extracted = extractFullCompetitors(items, our, 'name_catalog', {
        minTitleSimilarity: 0.28,
      });
      addHits(extracted);
    }
  }

  // --- 4) Site search por título si no está bloqueado ---
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
    // marca + primeras palabras significativas del título
    const words = normalizeTitle(title)
      .split(' ')
      .filter((w) => w.length > 2 && w !== normalizeTitle(our.brand || ''))
      .slice(0, 5);
    if (words.length) push(`${our.brand} ${words.join(' ')}`);
  } else if (our.brand && our.model) {
    push(`${our.brand} ${our.model}`);
  }

  // Título sin ml / pack / números de volumen sueltos al final
  const cleaned = title
    .replace(/\b\d+\s*(ml|g|gr|kg|l)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 8 && cleaned !== title) push(cleaned);

  return out.slice(0, 4);
}

async function resolveMarketplaceItemIds(
  client: MlApiClient,
  productId: string
): Promise<string[]> {
  try {
    const product = await client.getCatalogProduct(productId);
    const ids = new Set<string>();

    const pushId = (c: unknown) => {
      if (c == null) return;
      const s = String(c);
      if (/^ML[A-Z]?\d+/i.test(s) || s.startsWith('ML')) ids.add(s);
    };

    pushId(product?.buy_box_winner?.item_id);
    pushId(product?.buy_box_winner?.id);
    pushId(product?.permalink); // a veces no es id

    if (Array.isArray(product?.buy_box_winners)) {
      for (const w of product.buy_box_winners) {
        pushId(w?.item_id);
        pushId(w?.id);
      }
    }
    if (Array.isArray(product?.items)) {
      for (const it of product.items) {
        pushId(it?.item_id);
        pushId(it?.id);
      }
    }
    // Algunas respuestas anidan en settings / pickers
    if (Array.isArray(product?.pickers)) {
      for (const p of product.pickers) {
        if (Array.isArray(p?.products)) {
          for (const pp of p.products) pushId(pp?.item_id || pp?.id);
        }
      }
    }

    // Recorrido superficial de keys por si ML cambia el shape
    const walk = (obj: any, depth: number) => {
      if (!obj || depth > 4) return;
      if (typeof obj === 'string' && /^MLC\d{6,}$/i.test(obj)) {
        ids.add(obj);
        return;
      }
      if (Array.isArray(obj)) {
        for (const x of obj.slice(0, 30)) walk(x, depth + 1);
        return;
      }
      if (typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          if (/item_id|itemId/i.test(k)) pushId(v);
          else if (k === 'id' && typeof v === 'string' && /^MLC\d/i.test(v))
            pushId(v);
          else if (typeof v === 'object') walk(v, depth + 1);
        }
      }
    };
    walk(product, 0);

    return Array.from(ids)
      .filter((id) => /^MLC\d+/i.test(id))
      .slice(0, 40);
  } catch {
    return [];
  }
}
