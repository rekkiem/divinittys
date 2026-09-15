/**
 * scripts/dedupe-ml-products.ts
 *
 * Detecta y marca productos ML duplicados en Divinittys.
 * NUNCA borra filas.
 *
 * Criterio de identidad:
 *  1) mismo mlCatalogProductId (si existe)
 *  2) fallback: nombre normalizado + volumen + misma marca/categoría, similitud >= 0.92
 *
 * Canónico (en cada grupo):
 *  1) tiene mlCatalogProductId
 *  2) más pedidos (orderItems)
 *  3) más antiguo (createdAt)
 *
 * Sobre duplicados (solo con --confirm):
 *  - isActive = false
 *  - tag "duplicado-ml"
 *  - duplicateOfId = id del canónico
 *
 * Uso:
 *   npx tsx scripts/dedupe-ml-products.ts              # dry-run (default)
 *   npx tsx scripts/dedupe-ml-products.ts --confirm    # aplica cambios
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRM = process.argv.includes('--confirm');
const DRY = !CONFIRM;
const SIMILARITY_THRESHOLD = 0.92;

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  isActive: boolean;
  isOnSale: boolean;
  tags: string[];
  mlCatalogProductId: string | null;
  duplicateOfId: string | null;
  createdAt: Date;
  brandId: string | null;
  categoryId: string;
  orderCount: number;
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrae volumen tipo 250ml, 1l, 500 g */
function extractVolume(name: string): string | null {
  const m = name.toLowerCase().match(/(\d+[.,]?\d*)\s*(ml|l|g|kg|oz|fl\.?\s*oz)\b/i);
  if (!m) return null;
  const num = m[1].replace(',', '.');
  const unit = m[2].replace(/\s+/g, '').toLowerCase();
  return `${num}${unit}`;
}

function tokenSet(s: string): Set<string> {
  return new Set(s.split(' ').filter((t) => t.length > 1));
}

/** Jaccard simple sobre tokens */
function similarity(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function pickCanonical(group: ProductRow[]): ProductRow {
  return [...group].sort((a, b) => {
    const aCat = a.mlCatalogProductId ? 1 : 0;
    const bCat = b.mlCatalogProductId ? 1 : 0;
    if (bCat !== aCat) return bCat - aCat;
    if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}

async function loadProducts(): Promise<ProductRow[]> {
  const rows = await prisma.product.findMany({
    where: { sku: { startsWith: 'ML-MLC' } },
    select: {
      id: true,
      sku: true,
      name: true,
      slug: true,
      isActive: true,
      isOnSale: true,
      tags: true,
      mlCatalogProductId: true,
      duplicateOfId: true,
      createdAt: true,
      brandId: true,
      categoryId: true,
      _count: { select: { orderItems: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    slug: r.slug,
    isActive: r.isActive,
    isOnSale: r.isOnSale,
    tags: r.tags ?? [],
    mlCatalogProductId: r.mlCatalogProductId,
    duplicateOfId: r.duplicateOfId,
    createdAt: r.createdAt,
    brandId: r.brandId,
    categoryId: r.categoryId,
    orderCount: r._count.orderItems,
  }));
}

function groupByCatalogId(products: ProductRow[]): Map<string, ProductRow[]> {
  const map = new Map<string, ProductRow[]>();
  for (const p of products) {
    if (!p.mlCatalogProductId) continue;
    const list = map.get(p.mlCatalogProductId) ?? [];
    list.push(p);
    map.set(p.mlCatalogProductId, list);
  }
  return map;
}

function groupByNameFallback(
  products: ProductRow[],
  alreadyGrouped: Set<string>,
): ProductRow[][] {
  const candidates = products.filter((p) => !alreadyGrouped.has(p.id));
  const groups: ProductRow[][] = [];
  const used = new Set<string>();

  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    if (used.has(a.id)) continue;

    const na = normalizeName(a.name);
    const va = extractVolume(a.name);
    const group: ProductRow[] = [a];
    used.add(a.id);

    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j];
      if (used.has(b.id)) continue;

      // Misma marca y categoría si están definidas
      if (a.brandId && b.brandId && a.brandId !== b.brandId) continue;
      if (a.categoryId && b.categoryId && a.categoryId !== b.categoryId) continue;

      const nb = normalizeName(b.name);
      const vb = extractVolume(b.name);

      // Si ambos tienen volumen y difiere, no son el mismo producto
      if (va && vb && va !== vb) continue;

      const sim = similarity(na, nb);
      if (sim >= SIMILARITY_THRESHOLD) {
        group.push(b);
        used.add(b.id);
      }
    }

    if (group.length > 1) groups.push(group);
  }

  return groups;
}

type DedupeAction = {
  canonical: ProductRow;
  duplicates: ProductRow[];
  reason: string;
};

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(' DIVINITTYS — dedupe-ml-products');
  console.log(` Modo: ${DRY ? 'DRY-RUN (sin cambios)' : '⚠️  CONFIRM — aplicando'}`);
  console.log('═══════════════════════════════════════════════════\n');

  const products = await loadProducts();
  console.log(`Productos ML: ${products.length}\n`);

  const actions: DedupeAction[] = [];
  const alreadyGrouped = new Set<string>();

  // 1) Grupos por catalog_product_id
  const byCatalog = groupByCatalogId(products);
  for (const [catalogId, group] of byCatalog) {
    if (group.length < 2) continue;
    const canonical = pickCanonical(group);
    const duplicates = group.filter((p) => p.id !== canonical.id);
    for (const p of group) alreadyGrouped.add(p.id);
    actions.push({
      canonical,
      duplicates,
      reason: `catalog_product_id=${catalogId}`,
    });
  }

  // 2) Fallback por nombre
  const nameGroups = groupByNameFallback(products, alreadyGrouped);
  for (const group of nameGroups) {
    const canonical = pickCanonical(group);
    const duplicates = group.filter((p) => p.id !== canonical.id);
    actions.push({
      canonical,
      duplicates,
      reason: `nombre≈${normalizeName(canonical.name).slice(0, 60)}`,
    });
  }

  if (actions.length === 0) {
    console.log('No se detectaron grupos de duplicados.\n');
    return;
  }

  let totalDupes = 0;
  for (const action of actions) {
    totalDupes += action.duplicates.length;
    console.log(`── Grupo (${action.reason}) ──`);
    console.log(
      `  CANÓNICO  ${action.canonical.sku} | ${action.canonical.name} | pedidos=${action.canonical.orderCount} | active=${action.canonical.isActive} | catalog=${action.canonical.mlCatalogProductId ?? '-'}`,
    );
    for (const d of action.duplicates) {
      const already =
        d.duplicateOfId === action.canonical.id && d.tags.includes('duplicado-ml')
          ? ' [ya marcado]'
          : '';
      console.log(
        `  DUPLICADO ${d.sku} | ${d.name} | pedidos=${d.orderCount} | active=${d.isActive}${already}`,
      );
    }
    console.log('');
  }

  console.log(`Grupos: ${actions.length}`);
  console.log(`Duplicados a marcar: ${totalDupes}\n`);

  if (DRY) {
    console.log('→ Dry-run terminado. Ejecuta con --confirm para aplicar.\n');
    return;
  }

  console.log('Aplicando…');
  let updated = 0;
  for (const action of actions) {
    for (const d of action.duplicates) {
      const tags = Array.from(new Set([...(d.tags ?? []), 'duplicado-ml']));
      await prisma.product.update({
        where: { id: d.id },
        data: {
          isActive: false,
          duplicateOfId: action.canonical.id,
          tags,
        },
      });
      updated++;
      console.log(`  ✓ ${d.sku} → duplicateOf ${action.canonical.sku}`);
    }
  }

  console.log(`\n✅ Marcados como duplicado: ${updated}\n`);
}

main()
  .catch((e) => {
    console.error('ERROR:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());