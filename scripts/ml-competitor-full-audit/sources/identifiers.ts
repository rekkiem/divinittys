import type { OurProduct } from '../types';

/**
 * Construye queries de búsqueda prioritarias para un producto propio.
 * Orden: GTIN → SKU → marca+modelo → título limpio.
 */
export function buildSearchQueries(
  p: OurProduct
): { q: string; matchedBy: string }[] {
  const queries: { q: string; matchedBy: string }[] = [];
  const seen = new Set<string>();

  const push = (q: string, matchedBy: string) => {
    const key = q.trim().toLowerCase();
    if (!key || key.length < 3 || seen.has(key)) return;
    seen.add(key);
    queries.push({ q: q.trim(), matchedBy });
  };

  if (p.gtin) {
    const digits = p.gtin.replace(/\D/g, '');
    if (/^\d{8,14}$/.test(digits)) push(digits, 'gtin');
  }

  if (p.sku) {
    // SKU interno tipo ML-MLC123 → preferir el item id limpio también
    const raw = p.sku.replace(/^ML-/i, '').trim();
    push(p.sku, 'sku');
    if (raw !== p.sku) push(raw, 'sku');
  }

  if (p.brand && p.model) {
    push(`${p.brand} ${p.model}`, 'brand_model');
  } else if (p.brand) {
    // Marca sola es demasiado amplia; solo si hay título corto se combina abajo
  }

  const clean = (p.title || '')
    .replace(
      /\b(ml|ml\.|pack|set|original|oficial|envio|full|gratis|nuevo)\b/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  if (clean.length >= 8) {
    push(clean, 'title');
  }

  // Marca + primeras palabras del título si aún no hay brand_model
  if (p.brand && !queries.some((x) => x.matchedBy === 'brand_model')) {
    const words = clean
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 4)
      .join(' ');
    if (words) push(`${p.brand} ${words}`, 'brand_title');
  }

  return queries;
}
