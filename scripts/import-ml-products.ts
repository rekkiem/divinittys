#!/usr/bin/env tsx
/**
 * scripts/import-ml-products.ts
 * Importa productos desde Excel ML al catálogo DIVINITTYS.
 *
 * Uso:
 *   npx tsx scripts/import-ml-products.ts --file=./Publicaciones.xlsx
 *   npx tsx scripts/import-ml-products.ts --file=./Publicaciones.xlsx --dry-run
 *
 * catalogScope: BEAUTY (vitrina) | SECONDARY (anexo) | skip (prueba).
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, CatalogScope } from '@prisma/client';

const prisma = new PrismaClient();

type ParsedProduct = {
  itemId: string;
  title: string;
  brand: string;
  price: number;
  totalStock: number;
  isActive: boolean;
  variations: { name: string; stock: number }[];
  name: string;
  slug: string;
  sku: string;
  category: string;
  catalogScope: CatalogScope;
};

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  secondary: number;
  errors: { sku: string; title: string; error: string }[];
  duration: number;
};

const KNOWN_BRANDS = [
  'Davines', 'Elgon', 'Wella', 'Loreal', 'Schwarzkopf', 'Redken',
  'Matrix', 'Joico', 'Revlon', 'Olaplex', 'Bonmetique', 'Mood',
  'Kevin Murphy', 'Paul Mitchell', 'Bumble and bumble',
];

function extractBrand(title: string): string {
  const parts = title.split(' - ');
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].trim();
    const cleaned = lastPart.replace(/\d+ml|\d+g|\d+L/gi, '').trim();
    if (cleaned.length > 1 && cleaned.length < 30) return cleaned;
  }
  for (const brand of KNOWN_BRANDS) {
    if (title.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  return 'Sin marca';
}

/** Orden importa: cabello/styling ANTES de skincare genérico (crema). */
const CATEGORY_RULES: [string, string[]][] = [
  ['Styling',         ['sublimia', 'dd cream', 'dd champ', 'hair dd', 'styling', 'pomada', 'gel', 'cera', 'wax', 'spray', 'mist', 'mousse', 'serum', 'oil', 'fluido', 'crema para peinar']],
  ['Coloración',      ['tintura', 'tinte', 'color', 'alchemic', 'moda&styling', 'modastyling', 'get the color', 'dolce']],
  ['Shampoo',         ['shampoo', 'champú', 'champu']],
  ['Acondicionador',  ['acondicionador', 'conditioner', 'balsam', 'oi milk', 'moisturizing']],
  ['Tratamientos',    ['mask', 'máscara', 'mascarilla', 'treatment', 'repair', 'bond', 'olaplex']],
  ['Keratina',        ['keratina', 'keratin', 'btx', 'botox capilar']],
  ['Oxidantes',       ['oxi', 'oxidante', 'peroxide', 'revelador']],
  ['Herramientas',    ['plancha', 'secador', 'rizador', 'cepillo', 'peine', 'tijera']],
  ['Skincare',        ['facial', 'serum facial', 'limpiador facial', 'crema facial']],
];

const BEAUTY_CATEGORIES = new Set([
  'Coloración', 'Shampoo', 'Acondicionador', 'Tratamientos',
  'Keratina', 'Styling', 'Oxidantes', 'Herramientas', 'Cuidado Capilar',
]);

const SKIP_KEYWORDS = ['producto-prueba', 'producto prueba', 'test product'];

const SECONDARY_RULES: { keywords: string[]; category: string }[] = [
  {
    keywords: ['libro', 'montessori', 'bebe', 'bebé', 'sensorial', 'juguete'],
    category: 'Infantil',
  },
  {
    keywords: ['collar', 'cadena', 'plata 925', 'acero quirurgico', 'acero quirúrgico', 'anillo', 'pulsera', 'bijou', 'bisuteria', 'bisutería'],
    category: 'Accesorios',
  },
];

function detectCategory(title: string): string {
  const t = title.toLowerCase();
  for (const [cat, keywords] of CATEGORY_RULES) {
    if (keywords.some((kw) => t.includes(kw))) return cat;
  }
  return 'Cuidado Capilar';
}

type RouteResult =
  | { action: 'skip'; reason: string }
  | { action: 'import'; catalogScope: CatalogScope; category: string };

function routeProduct(title: string, detectedCategory: string): RouteResult {
  const t = title.toLowerCase();

  if (SKIP_KEYWORDS.some((kw) => t.includes(kw))) {
    return { action: 'skip', reason: 'producto de prueba' };
  }

  for (const rule of SECONDARY_RULES) {
    if (rule.keywords.some((kw) => t.includes(kw))) {
      return { action: 'import', catalogScope: 'SECONDARY', category: rule.category };
    }
  }

  if (BEAUTY_CATEGORIES.has(detectedCategory)) {
    return { action: 'import', catalogScope: 'BEAUTY', category: detectedCategory };
  }

  // Skincare u otras: SECONDARY con su categoría detectada (no se pierde el SKU)
  return { action: 'import', catalogScope: 'SECONDARY', category: detectedCategory };
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

function cleanName(title: string, brand: string): string {
  let name = title.trim();
  if (name.endsWith(` - ${brand}`)) {
    name = name.slice(0, -(brand.length + 3)).trim();
  }
  return name;
}

function parseExcel(filePath: string): ParsedProduct[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const wb = XLSX.readFile(filePath, { cellFormula: false, cellText: true, sheetStubs: true });
  const sheet = wb.Sheets['Publicaciones'];
  if (!sheet) throw new Error('Sheet "Publicaciones" not found');

  const raw = XLSX.utils.sheet_to_json<any>(sheet, {
    header: ['FAMILY_ID', 'ITEM_ID', 'PRODUCT_NUMBER', 'VARIATION_ID', 'TITLE', 'VARIATIONS',
      'QUANTITY', 'PRICE', 'CURRENCY_ID', 'TP_P1', 'TP_Q1', 'TP_P2', 'TP_Q2', 'TP_P3',
      'TP_Q3', 'TP_P4', 'TP_Q4', 'TP_P5', 'TP_Q5', 'CONDITION', 'SHIPPING', 'LISTING_TYPE',
      'FEE', 'STATUS'],
    range: 5,
    defval: '',
  });

  const productMap = new Map<string, ParsedProduct>();
  let skippedFormulas = 0;

  for (const row of raw) {
    const itemId = String(row.ITEM_ID || '').trim();
    if (!itemId.startsWith('MLC')) continue;

    const titleRaw = String(row.TITLE || '').trim();
    const isFormulaRow = titleRaw.startsWith('=');

    const priceRaw = row.PRICE;
    const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw).replace(/[^0-9.]/g, '')) || 0;
    const qty = typeof row.QUANTITY === 'number' ? row.QUANTITY : parseInt(String(row.QUANTITY)) || 0;
    const status = String(row.STATUS || 'Activa').trim().toLowerCase();
    const isActive = !status || ['activa', 'active', ''].includes(status);

    const variation = String(row.VARIATIONS || '').trim();
    const hasVariation = variation && variation !== '-' && variation !== '0';

    if (!isFormulaRow && titleRaw) {
      const brand = extractBrand(titleRaw);
      const name = cleanName(titleRaw, brand);
      const detected = detectCategory(titleRaw);
      const routed = routeProduct(titleRaw, detected);
      if (routed.action === 'skip') continue;

      const category = routed.category;
      const catalogScope = routed.catalogScope;
      const slug = toSlug(name) + '-' + itemId.toLowerCase();
      const sku = `ML-${itemId}`;

      productMap.set(itemId, {
        itemId, title: titleRaw, brand, price,
        totalStock: qty, isActive, variations: [],
        name, slug, sku, category, catalogScope,
      });
    } else if (isFormulaRow && hasVariation) {
      const parent = productMap.get(itemId);
      if (parent) {
        parent.variations.push({ name: variation, stock: qty });
        parent.totalStock += qty;
      }
      skippedFormulas++;
    }
  }

  if (skippedFormulas > 0) {
    console.log(`  ℹ️  Processed ${skippedFormulas} variation rows`);
  }

  return Array.from(productMap.values()).filter((p) => p.price > 0 && p.name);
}

async function getOrCreateCategory(name: string): Promise<string> {
  const slug = toSlug(name);
  const existing = await prisma.category.findFirst({ where: { slug } });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: { name, slug, isActive: true },
  });
  return created.id;
}

async function getOrCreateBrand(name: string): Promise<string | null> {
  if (!name || name === 'Sin marca') return null;
  const slug = toSlug(name);
  const existing = await prisma.brand.findFirst({ where: { slug } });
  if (existing) return existing.id;
  const created = await prisma.brand.create({
    data: { name, slug, isActive: true },
  });
  return created.id;
}

async function importProducts(
  products: ParsedProduct[],
  options: { dryRun: boolean; categoryFilter?: string }
): Promise<ImportResult> {
  const result: ImportResult = {
    created: 0, updated: 0, skipped: 0, secondary: 0, errors: [], duration: 0,
  };
  const start = Date.now();

  const filtered = options.categoryFilter
    ? products.filter((p) => p.category.toLowerCase().includes(options.categoryFilter!.toLowerCase()))
    : products;

  console.log(`\n📦 Processing ${filtered.length} products...`);

  const categoryCache = new Map<string, string>();
  const brandCache = new Map<string, string | null>();

  if (!options.dryRun) {
    const uniqueCategories = [...new Set(filtered.map((p) => p.category))];
    const uniqueBrands = [...new Set(filtered.map((p) => p.brand))];
    for (const cat of uniqueCategories) {
      categoryCache.set(cat, await getOrCreateCategory(cat));
    }
    for (const brand of uniqueBrands) {
      brandCache.set(brand, await getOrCreateBrand(brand));
    }
  }

  for (const product of filtered) {
    try {
      if (product.catalogScope === 'SECONDARY') {
        result.secondary++;
        console.log(`  📎 SECONDARY: ${product.sku} | ${product.name} | cat=${product.category}`);
      }

      if (options.dryRun) {
        console.log(`  [DRY RUN] [${product.catalogScope}] ${product.sku} | ${product.name} | $${product.price} | ${product.category}`);
        result.created++;
        continue;
      }

      const categoryId = categoryCache.get(product.category)!;
      const brandId = brandCache.get(product.brand) ?? null;

      const existing = await prisma.product.findFirst({
        where: { OR: [{ sku: product.sku }, { slug: product.slug }] },
        include: { inventory: true },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            basePrice: product.price,
            isActive: product.isActive,
            catalogScope: product.catalogScope,
            categoryId,
            isFeatured: product.catalogScope === 'SECONDARY' ? false : existing.isFeatured,
          },
        });
        if (existing.inventory) {
          await prisma.inventory.update({
            where: { productId: existing.id },
            data: { stock: product.totalStock },
          });
        }
        result.updated++;
        process.stdout.write('u');
      } else {
        const tags = [
          product.category.toLowerCase(),
          product.brand.toLowerCase(),
          product.catalogScope === 'SECONDARY' ? 'catalog:secondary' : 'catalog:beauty',
        ].filter(Boolean);

        await prisma.$transaction(async (tx) => {
          const p = await tx.product.create({
            data: {
              sku: product.sku,
              name: product.name,
              slug: product.slug,
              description: `${product.title}${product.variations.length > 0 ? `. Disponible en ${product.variations.length} variantes.` : ''}`,
              basePrice: product.price,
              isActive: product.isActive,
              isFeatured: false,
              isOnSale: false,
              catalogScope: product.catalogScope,
              tags,
              categoryId,
              brandId,
            },
          });
          await tx.inventory.create({
            data: {
              productId: p.id,
              stock: product.totalStock,
              lowStockThreshold: 5,
              trackStock: true,
            },
          });
        });

        result.created++;
        process.stdout.write('.');
      }
    } catch (err: any) {
      result.errors.push({ sku: product.sku, title: product.name, error: err.message });
      process.stdout.write('E');
    }
  }

  result.duration = Date.now() - start;
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith('--file='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  const catFilter = args.find((a) => a.startsWith('--category='))?.split('=')[1];

  if (!fileArg) {
    console.error('Usage: npx tsx scripts/import-ml-products.ts --file=./Publicaciones.xlsx [--dry-run] [--category=coloracion]');
    process.exit(1);
  }

  const filePath = path.resolve(fileArg);
  console.log(`\n🔍 DIVINITTYS — Importador ML (catalogScope)`);
  console.log(`   Archivo: ${filePath}`);
  console.log(`   Modo: ${dryRun ? '🧪 DRY RUN' : '🚀 IMPORTACIÓN REAL'}`);

  let products: ParsedProduct[];
  try {
    console.log('\n📖 Leyendo Excel...');
    products = parseExcel(filePath);
    console.log(`   ✅ ${products.length} productos (tras skip de prueba)`);

    const byScope = { BEAUTY: 0, SECONDARY: 0 };
    for (const p of products) byScope[p.catalogScope]++;
    console.log(`   BEAUTY: ${byScope.BEAUTY} | SECONDARY: ${byScope.SECONDARY}`);
  } catch (err: any) {
    console.error(`\n❌ Error leyendo Excel: ${err.message}`);
    process.exit(1);
  }

  const result = await importProducts(products, { dryRun, categoryFilter: catFilter });

  console.log(`\n\n${'─'.repeat(50)}`);
  console.log(`📊 Resultado:`);
  console.log(`   ✅ Creados:     ${result.created}`);
  console.log(`   🔄 Actualizados: ${result.updated}`);
  console.log(`   📎 Secondary:   ${result.secondary}`);
  console.log(`   ⏭️  Omitidos:    ${result.skipped}`);
  console.log(`   ❌ Errores:     ${result.errors.length}`);
  console.log(`   ⏱️  Duración:    ${(result.duration / 1000).toFixed(1)}s`);

  if (result.errors.length > 0) {
    for (const e of result.errors) {
      console.log(`   [${e.sku}] ${e.title}: ${e.error}`);
    }
  }
}

main()
  .catch((e) => { console.error('\n❌ Error fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
