#!/usr/bin/env tsx
/**
 * Controlled production test for MercadoLibre -> Divinittys.
 *
 * Imports only a small, validated sample and downloads public MercadoLibre
 * pictures into MinIO before creating ProductImage records.
 *
 * Usage:
 *   npx tsx scripts/test-ml-import-with-images.ts --file=/app/imports/Publicaciones.xlsx --limit=5
 *
 * The script is intentionally conservative:
 * - only active-looking rows with a known hair-care brand are candidates
 * - obvious non-hair products are rejected
 * - existing SKUs are skipped (never overwritten)
 * - products are created only after at least one image is successfully stored
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { uploadToMinio, generateImageKey } from '../src/services/minioClient';

const prisma = new PrismaClient();

const KNOWN_BRANDS = [
  'Davines', 'Elgon', 'Wella', 'Loreal', 'L\'Oreal', 'Schwarzkopf',
  'Redken', 'Matrix', 'Joico', 'Revlon', 'Olaplex', 'Bonmetique', 'Mood',
  'Kevin Murphy', 'Paul Mitchell', 'Bumble and bumble',
];

const REJECT_WORDS = [
  'bebe', 'bebé', 'montessori', 'collar', 'aros', 'plata 925', 'acero quirurgico',
  'acero quirúrgico', 'motor de arranque', 'automovil', 'automóvil', 'chevrolet',
  'pontiac', 'saturn', 'cachorro', 'perro', 'mascota', 'juguete', 'celular',
  'telefono', 'teléfono', 'repuesto', 'neumatico', 'neumático', 'herramienta automotriz',
];

const CATEGORY_RULES: [string, string[]][] = [
  ['Coloración', ['tintura', 'tinte', 'color', 'alchemic', 'moda&styling', 'modastyling', 'get the color', 'dolce']],
  ['Shampoo', ['shampoo', 'champú', 'champu']],
  ['Acondicionador', ['acondicionador', 'conditioner', 'balsam', 'oi milk', 'moisturizing']],
  ['Tratamientos', ['mask', 'máscara', 'mascarilla', 'treatment', 'repair', 'bond', 'olaplex']],
  ['Keratina', ['keratina', 'keratin', 'btx', 'botox capilar']],
  ['Styling', ['styling', 'pomada', 'gel', 'cera', 'wax', 'spray', 'mist', 'mousse', 'serum', 'oil', 'fluido']],
  ['Oxidantes', ['oxi', 'oxidante', 'peroxide', 'revelador']],
  ['Herramientas', ['plancha', 'secador', 'rizador', 'cepillo', 'peine', 'tijera']],
];

function toSlug(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 100);
}

function extractBrand(title: string): string {
  for (const brand of KNOWN_BRANDS) {
    if (title.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  return '';
}

function detectCategory(title: string): string {
  const t = title.toLowerCase();
  for (const [category, keywords] of CATEGORY_RULES) {
    if (keywords.some(k => t.includes(k))) return category;
  }
  return 'Cuidado Capilar';
}

function isRejected(title: string): string | null {
  const t = title.toLowerCase();
  return REJECT_WORDS.find(word => t.includes(word)) ?? null;
}

type Candidate = {
  itemId: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  status: string;
};

function parseCandidates(filePath: string): Candidate[] {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const wb = XLSX.readFile(filePath, { cellFormula: false, cellText: true, sheetStubs: true });
  const sheet = wb.Sheets['Publicaciones'];
  if (!sheet) throw new Error('Sheet "Publicaciones" not found');

  const rows = XLSX.utils.sheet_to_json<any>(sheet, {
    header: ['FAMILY_ID','ITEM_ID','PRODUCT_NUMBER','VARIATION_ID','TITLE','VARIATIONS',
      'QUANTITY','PRICE','CURRENCY_ID','TP_P1','TP_Q1','TP_P2','TP_Q2','TP_P3','TP_Q3',
      'TP_P4','TP_Q4','TP_P5','TP_Q5','CONDITION','SHIPPING','LISTING_TYPE','FEE','STATUS'],
    range: 5,
    defval: '',
  });

  const byItem = new Map<string, Candidate>();
  for (const row of rows) {
    const itemId = String(row.ITEM_ID || '').trim();
    const title = String(row.TITLE || '').trim();
    if (!itemId.startsWith('MLC') || !title || title.startsWith('=')) continue;
    if (byItem.has(itemId)) continue;

    const priceRaw = row.PRICE;
    const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw).replace(/[^0-9.]/g, '')) || 0;
    const stock = typeof row.QUANTITY === 'number' ? row.QUANTITY : parseInt(String(row.QUANTITY)) || 0;
    const status = String(row.STATUS || '').trim().toLowerCase();
    const brand = extractBrand(title);
    const rejected = isRejected(title);

    if (!brand || rejected || price <= 0) continue;
    if (status && !['activa', 'active'].includes(status)) continue;

    byItem.set(itemId, { itemId, title, brand, category: detectCategory(title), price, stock, status });
  }
  return [...byItem.values()];
}

async function getOrCreateCategory(name: string): Promise<string> {
  const slug = toSlug(name);
  const existing = await prisma.category.findFirst({ where: { slug } });
  if (existing) return existing.id;
  const created = await prisma.category.create({ data: { name, slug, isActive: true } });
  return created.id;
}

async function getOrCreateBrand(name: string): Promise<string> {
  const slug = toSlug(name);
  const existing = await prisma.brand.findFirst({ where: { slug } });
  if (existing) return existing.id;
  const created = await prisma.brand.create({ data: { name, slug, isActive: true } });
  return created.id;
}

async function getMercadoLibrePictures(itemId: string): Promise<{ url: string; secureUrl?: string }[]> {
  const response = await fetch(`https://api.mercadolibre.cl/items/${encodeURIComponent(itemId)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'DivinittysImporter/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`MercadoLibre API ${response.status} for ${itemId}`);
  const data = await response.json() as { pictures?: { url?: string; secure_url?: string }[] };
  return (data.pictures ?? [])
    .map(p => ({ url: p.url || '', secureUrl: p.secure_url }))
    .filter(p => p.url || p.secureUrl);
}

async function downloadImage(url: string): Promise<{ body: Buffer; contentType: string; ext: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'follow' });
  if (!response.ok) throw new Error(`image HTTP ${response.status}`);
  const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!contentType.startsWith('image/')) throw new Error(`unexpected content-type ${contentType}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (!body.length) throw new Error('empty image response');
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[contentType] || 'jpg';
  return { body, contentType, ext };
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1];
  const limit = Math.max(1, Math.min(5, Number(args.find(a => a.startsWith('--limit='))?.split('=')[1] || 5)));
  const dryRun = args.includes('--dry-run');
  if (!fileArg) throw new Error('Usage: npx tsx scripts/test-ml-import-with-images.ts --file=/app/imports/Publicaciones.xlsx [--limit=5] [--dry-run]');

  const filePath = path.resolve(fileArg);
  const candidates = parseCandidates(filePath);
  console.log(`\n🧪 DIVINITTYS — controlled MercadoLibre import`);
  console.log(`Candidates after validation: ${candidates.length}`);
  console.log(`Testing: ${Math.min(limit, candidates.length)} products`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'REAL IMPORT'}`);

  let created = 0, skipped = 0, errors = 0, images = 0;

  for (const product of candidates.slice(0, limit)) {
    console.log(`\n▶ ${product.itemId} | ${product.title}`);
    console.log(`  brand=${product.brand} category=${product.category} price=${product.price} stock=${product.stock}`);

    try {
      const sku = `ML-${product.itemId}`;
      const slug = `${toSlug(product.title)}-${product.itemId.toLowerCase()}`;
      const existing = await prisma.product.findFirst({ where: { OR: [{ sku }, { slug }] } });
      if (existing) {
        console.log(`  ⏭️ existing product ${existing.id}; skipping`);
        skipped++;
        continue;
      }

      const pictures = await getMercadoLibrePictures(product.itemId);
      console.log(`  MercadoLibre pictures: ${pictures.length}`);
      if (!pictures.length) throw new Error('no MercadoLibre pictures found');

      if (dryRun) {
        console.log('  ✅ image source available; no DB/MinIO changes');
        continue;
      }

      const categoryId = await getOrCreateCategory(product.category);
      const brandId = await getOrCreateBrand(product.brand);
      const uploaded: { url: string; alt: string; sortOrder: number; isMain: boolean }[] = [];

      for (let i = 0; i < Math.min(pictures.length, 5); i++) {
        const sourceUrl = pictures[i].secureUrl || pictures[i].url;
        const image = await downloadImage(sourceUrl);
        const key = generateImageKey(`ml-${product.itemId}`, image.ext);
        const publicUrl = await uploadToMinio(key, image.body, image.contentType);
        uploaded.push({ url: publicUrl, alt: product.title, sortOrder: i, isMain: i === 0 });
        console.log(`  📷 uploaded ${i + 1}/${Math.min(pictures.length, 5)}: ${publicUrl}`);
      }

      await prisma.$transaction(async tx => {
        const p = await tx.product.create({
          data: {
            sku,
            name: product.title,
            slug,
            description: product.title,
            basePrice: product.price,
            isActive: true,
            isFeatured: false,
            isOnSale: false,
            tags: [product.category.toLowerCase(), product.brand.toLowerCase()],
            categoryId,
            brandId,
            imageUrl: uploaded[0].url,
            inventory: { create: { stock: product.stock, lowStockThreshold: 5, trackStock: true } },
            images: { create: uploaded },
          },
        });
        console.log(`  ✅ product created: ${p.id}`);
      });
      created++;
      images += uploaded.length;
    } catch (err: any) {
      errors++;
      console.error(`  ❌ ${err?.message || err}`);
    }
  }

  console.log(`\n────────────────────────────────────────────`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Images uploaded: ${images}`);
  console.log(`Errors: ${errors}`);
  if (dryRun) console.log('No database or MinIO changes were made.');
}

main().catch(err => { console.error(`\n❌ Fatal: ${err.message}`); process.exitCode = 1; }).finally(() => prisma.$disconnect());
