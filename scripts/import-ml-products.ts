#!/usr/bin/env tsx
/**
 * scripts/import-ml-products.ts
 * ─────────────────────────────────────────────────────────────────
 * Importa productos desde el formato Excel de MercadoLibre
 * al catálogo de DIVINITTYS.
 *
 * Formato esperado: Publicaciones-YYYY_MM_DD-HH_MM.xlsx
 * (Exportado desde Mercado Libre → Mis publicaciones)
 *
 * Uso:
 *   npx tsx scripts/import-ml-products.ts --file=./Publicaciones.xlsx
 *   npx tsx scripts/import-ml-products.ts --file=./Publicaciones.xlsx --dry-run
 *   npx tsx scripts/import-ml-products.ts --file=./Publicaciones.xlsx --category=coloracion
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Types ────────────────────────────────────────────────────────
type RawRow = {
  ITEM_ID:      string;
  VARIATION_ID: string;
  TITLE:        string;
  VARIATIONS:   string;
  QUANTITY:     number;
  PRICE:        number;
  STATUS:       string;
};

type ParsedProduct = {
  itemId:     string;
  title:      string;
  brand:      string;
  price:      number;
  totalStock: number;
  isActive:   boolean;
  variations: { name: string; stock: number }[];
  // Derived
  name:       string;
  slug:       string;
  sku:        string;
  category:   string;
};

type ImportResult = {
  created:  number;
  updated:  number;
  skipped:  number;
  errors:   { sku: string; title: string; error: string }[];
  duration: number;
};

// ── Brand extraction ─────────────────────────────────────────────
const KNOWN_BRANDS = [
  'Davines', 'Elgon', 'Wella', 'Loreal', 'Schwarzkopf', 'Redken',
  'Matrix', 'Joico', 'Revlon', 'Olaplex', 'Bonmetique', 'Mood',
  'Kevin Murphy', 'Paul Mitchell', 'Bumble and bumble',
];

function extractBrand(title: string): string {
  const parts = title.split(' - ');
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].trim();
    // Clean brand: remove size info like "300ml"
    const cleaned = lastPart.replace(/\d+ml|\d+g|\d+L/gi, '').trim();
    if (cleaned.length > 1 && cleaned.length < 30) return cleaned;
  }
  for (const brand of KNOWN_BRANDS) {
    if (title.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  return 'Sin marca';
}

// ── Category detection ────────────────────────────────────────────
const CATEGORY_RULES: [string, string[]][] = [
  ['Coloración',      ['tintura', 'tinte', 'color', 'alchemic', 'moda&styling', 'modastyling', 'get the color', 'dolce']],
  ['Shampoo',         ['shampoo', 'champú', 'champu']],
  ['Acondicionador',  ['acondicionador', 'conditioner', 'balsam', 'oi milk', 'moisturizing']],
  ['Tratamientos',    ['mask', 'máscara', 'mascarilla', 'treatment', 'repair', 'bond', 'olaplex']],
  ['Keratina',        ['keratina', 'keratin', 'btx', 'botox capilar']],
  ['Styling',         ['styling', 'pomada', 'gel', 'cera', 'wax', 'spray', 'mist', 'mousse', 'serum', 'oil', 'fluido']],
  ['Oxidantes',       ['oxi', 'oxidante', 'peroxide', 'revelador']],
  ['Herramientas',    ['plancha', 'secador', 'rizador', 'cepillo', 'peine', 'tijera']],
  ['Skincare',        ['facial', 'crema', 'serum facial', 'limpiador']],
];

function detectCategory(title: string): string {
  const t = title.toLowerCase();
  for (const [cat, keywords] of CATEGORY_RULES) {
    if (keywords.some(kw => t.includes(kw))) return cat;
  }
  return 'Cuidado Capilar';
}

// ── Slug generation ───────────────────────────────────────────────
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

// ── Clean product name (remove brand suffix) ──────────────────────
function cleanName(title: string, brand: string): string {
  let name = title.trim();
  if (name.endsWith(` - ${brand}`)) {
    name = name.slice(0, -(brand.length + 3)).trim();
  }
  return name;
}

// ── Parse Excel ───────────────────────────────────────────────────
function parseExcel(filePath: string): ParsedProduct[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const wb    = XLSX.readFile(filePath, { cellFormula: false, cellText: true, sheetStubs: true });
  const sheet = wb.Sheets['Publicaciones'];
  if (!sheet) throw new Error('Sheet "Publicaciones" not found');

  const raw = XLSX.utils.sheet_to_json<any>(sheet, {
    header: ['FAMILY_ID','ITEM_ID','PRODUCT_NUMBER','VARIATION_ID','TITLE','VARIATIONS',
             'QUANTITY','PRICE','CURRENCY_ID','TP_P1','TP_Q1','TP_P2','TP_Q2','TP_P3',
             'TP_Q3','TP_P4','TP_Q4','TP_P5','TP_Q5','CONDITION','SHIPPING','LISTING_TYPE',
             'FEE','STATUS'],
    range: 5,  // Start after header rows
    defval: '',
  });

  const productMap = new Map<string, ParsedProduct>();
  let skippedFormulas = 0;

  for (const row of raw) {
    const itemId = String(row.ITEM_ID || '').trim();
    if (!itemId.startsWith('MLC')) continue;

    // Skip formula cells (data_only mode doesn't always work)
    const titleRaw = String(row.TITLE || '').trim();
    const isFormulaRow = titleRaw.startsWith('=');

    const priceRaw = row.PRICE;
    const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw).replace(/[^0-9.]/g, '')) || 0;
    const qty   = typeof row.QUANTITY === 'number' ? row.QUANTITY : parseInt(String(row.QUANTITY)) || 0;
    const status = String(row.STATUS || 'Activa').trim().toLowerCase();
    const isActive = ['activa', 'active', ''].includes(status);

    const variation = String(row.VARIATIONS || '').trim();
    const hasVariation = variation && variation !== '-' && variation !== '0';

    if (!isFormulaRow && titleRaw) {
      // This is the parent row
      const brand    = extractBrand(titleRaw);
      const name     = cleanName(titleRaw, brand);
      const category = detectCategory(titleRaw);
      const slug     = toSlug(name) + '-' + itemId.toLowerCase();
      const sku      = `ML-${itemId}`;

      productMap.set(itemId, {
        itemId, title: titleRaw, brand, price,
        totalStock: qty, isActive, variations: [],
        name, slug, sku, category,
      });
    } else if (isFormulaRow && hasVariation) {
      // Variation row
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

  return Array.from(productMap.values()).filter(p => p.price > 0 && p.name);
}

// ── DB Helpers ────────────────────────────────────────────────────
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

// ── Main Import ───────────────────────────────────────────────────
async function importProducts(
  products: ParsedProduct[],
  options: { dryRun: boolean; categoryFilter?: string }
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [], duration: 0 };
  const start = Date.now();

  const filtered = options.categoryFilter
    ? products.filter(p => p.category.toLowerCase().includes(options.categoryFilter!.toLowerCase()))
    : products;

  console.log(`\n📦 Processing ${filtered.length} products...`);

  // Pre-fetch all category and brand IDs
  const categoryCache = new Map<string, string>();
  const brandCache    = new Map<string, string | null>();

  if (!options.dryRun) {
    const uniqueCategories = [...new Set(filtered.map(p => p.category))];
    const uniqueBrands     = [...new Set(filtered.map(p => p.brand))];

    for (const cat of uniqueCategories) {
      categoryCache.set(cat, await getOrCreateCategory(cat));
    }
    for (const brand of uniqueBrands) {
      brandCache.set(brand, await getOrCreateBrand(brand));
    }
  }

  for (const product of filtered) {
    try {
      if (options.dryRun) {
        console.log(`  [DRY RUN] ${product.sku} | ${product.name} | $${product.price} | ${product.category}`);
        result.created++;
        continue;
      }

      const categoryId = categoryCache.get(product.category)!;
      const brandId    = brandCache.get(product.brand) ?? null;

      // Check if product exists (by SKU or slug)
      const existing = await prisma.product.findFirst({
        where: { OR: [{ sku: product.sku }, { slug: product.slug }] },
        include: { inventory: true },
      });

      if (existing) {
        // Update price and stock
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            basePrice:  product.price,
            isActive:   product.isActive,
          },
        });
        if (existing.inventory) {
          await prisma.inventory.update({
            where: { productId: existing.id },
            data:  { stock: product.totalStock },
          });
        }
        result.updated++;
        process.stdout.write('u');
      } else {
        // Create new product
        const tags = [product.category.toLowerCase(), product.brand.toLowerCase()].filter(Boolean);

        await prisma.$transaction(async (tx) => {
          const p = await tx.product.create({
            data: {
              sku:         product.sku,
              name:        product.name,
              slug:        product.slug,
              description: `${product.title}${product.variations.length > 0 ? `. Disponible en ${product.variations.length} variantes.` : ''}`,
              basePrice:   product.price,
              isActive:    product.isActive,
              isFeatured:  false,
              isOnSale:    false,
              tags,
              categoryId,
              brandId,
            },
          });
          await tx.inventory.create({
            data: {
              productId:         p.id,
              stock:             product.totalStock,
              lowStockThreshold: 5,
              trackStock:        true,
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

// ── CLI ───────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  const catFilter = args.find(a => a.startsWith('--category='))?.split('=')[1];

  if (!fileArg) {
    console.error('Usage: npx tsx scripts/import-ml-products.ts --file=./Publicaciones.xlsx [--dry-run] [--category=coloracion]');
    process.exit(1);
  }

  const filePath = path.resolve(fileArg);
  console.log(`\n🔍 DIVINITTYS — Importador de productos MercadoLibre`);
  console.log(`   Archivo: ${filePath}`);
  console.log(`   Modo: ${dryRun ? '🧪 DRY RUN (sin cambios en DB)' : '🚀 IMPORTACIÓN REAL'}`);
  if (catFilter) console.log(`   Filtro categoría: ${catFilter}`);

  let products: ParsedProduct[];
  try {
    console.log('\n📖 Leyendo archivo Excel...');
    products = parseExcel(filePath);
    console.log(`   ✅ ${products.length} productos encontrados`);

    // Stats
    const cats = new Map<string, number>();
    const brands = new Map<string, number>();
    for (const p of products) {
      cats.set(p.category, (cats.get(p.category) || 0) + 1);
      brands.set(p.brand, (brands.get(p.brand) || 0) + 1);
    }
    console.log('\n   Categorías detectadas:');
    for (const [cat, count] of [...cats.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${cat}: ${count}`);
    }
    console.log('\n   Top marcas:');
    for (const [brand, count] of [...brands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      console.log(`     ${brand}: ${count}`);
    }
  } catch (err: any) {
    console.error(`\n❌ Error leyendo Excel: ${err.message}`);
    process.exit(1);
  }

  const result = await importProducts(products, { dryRun, categoryFilter: catFilter });

  console.log(`\n\n${'─'.repeat(50)}`);
  console.log(`📊 Resultado de importación:`);
  console.log(`   ✅ Creados:    ${result.created}`);
  console.log(`   🔄 Actualizados: ${result.updated}`);
  console.log(`   ⏭️  Omitidos:   ${result.skipped}`);
  console.log(`   ❌ Errores:    ${result.errors.length}`);
  console.log(`   ⏱️  Duración:   ${(result.duration / 1000).toFixed(1)}s`);

  if (result.errors.length > 0) {
    console.log('\n❌ Productos con error:');
    for (const e of result.errors) {
      console.log(`   [${e.sku}] ${e.title}: ${e.error}`);
    }
  }

  if (dryRun) {
    console.log('\n💡 Para importar realmente, ejecuta sin --dry-run');
  } else {
    console.log('\n✅ Importación completada');
  }
}

main()
  .catch(e => { console.error('\n❌ Error fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
