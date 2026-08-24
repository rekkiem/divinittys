#!/usr/bin/env tsx
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { normalizeMercadoLibreVariations, type MercadoLibreVariation } from '../src/lib/mercadolibre/variants';

const prisma = new PrismaClient();
const TOKEN_FILE = process.env.ML_TOKEN_FILE || '/app/.oauth/ml-tokens.json';
const PAGE_SIZE = 50;

type TokenData = { access_token: string };

function getToken() {
  const data: TokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  if (!data.access_token) throw new Error('No existe access_token');
  return data.access_token;
}

async function mlFetch(url: string) {
  const response = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${getToken()}` }, signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  const data = JSON.parse(text);
  if (!response.ok) throw new Error(`Mercado Libre HTTP ${response.status}: ${text.slice(0, 500)}`);
  return data;
}

async function getAllItemIds() {
  const ids: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const data = await mlFetch(`https://api.mercadolibre.com/users/55783347/items/search?limit=${PAGE_SIZE}&offset=${offset}`);
    ids.push(...(data.results || []));
    if ((data.results || []).length < PAGE_SIZE || ids.length >= Number(data.paging?.total || ids.length)) break;
  }
  return [...new Set(ids)];
}

async function migrateItem(itemId: string, dryRun: boolean) {
  const item = await mlFetch(`https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}?attributes=id,title,price,status,available_quantity,variations`);
  const variations = Array.isArray(item.variations) ? item.variations as MercadoLibreVariation[] : [];
  if (!variations.length) return { variants: 0, skipped: true };

  const product = await prisma.product.findFirst({ where: { sku: `ML-${itemId}` }, include: { variants: true, inventory: true } });
  if (!product) return { variants: 0, skipped: true };

  const normalized = normalizeMercadoLibreVariations(itemId, Number(item.price || product.basePrice), variations);
  console.log(`\n${itemId} | ${item.title} | ${normalized.length} variantes`);
  normalized.forEach((v) => console.log(`  ${v.variationId} | ${v.name} | stock=${v.stock} | $${v.price}`));
  if (dryRun) return { variants: normalized.length, skipped: false };

  await prisma.$transaction(async (tx) => {
    const seen = new Set<string>();
    for (const v of normalized) {
      const existing = await tx.productVariant.findFirst({ where: { productId: product.id, options: { path: ['variationId'], equals: v.variationId } } });
      if (existing) {
        await tx.productVariant.update({ where: { id: existing.id }, data: { sku: v.sku, name: v.name, price: v.price, stock: v.stock, options: v.options, isActive: true } });
      } else {
        await tx.productVariant.create({ data: { productId: product.id, sku: v.sku, name: v.name, price: v.price, stock: v.stock, options: v.options, isActive: true } });
      }
      seen.add(v.variationId);
    }

    // Never delete old variants: historical order_items may reference them.
    const existingVariants = await tx.productVariant.findMany({ where: { productId: product.id }, select: { id: true, options: true } });
    for (const existing of existingVariants) {
      const variationId = typeof existing.options === 'object' && existing.options && 'variationId' in existing.options ? String((existing.options as any).variationId) : null;
      if (variationId && !seen.has(variationId)) await tx.productVariant.update({ where: { id: existing.id }, data: { stock: 0, isActive: false } });
    }

    const activeVariants = await tx.productVariant.findMany({ where: { productId: product.id, isActive: true }, select: { stock: true } });
    const aggregateStock = activeVariants.reduce((sum, v) => sum + v.stock, 0);
    await tx.inventory.upsert({ where: { productId: product.id }, update: { stock: aggregateStock, trackStock: true }, create: { productId: product.id, stock: aggregateStock, lowStockThreshold: 5, trackStock: true } });
  });

  return { variants: normalized.length, skipped: false };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  const only = args.find((a) => a.startsWith('--item='))?.split('=')[1];

  console.log(`DIVINITTYS — MIGRACIÓN DE VARIANTES MERCADOLIBRE (${dryRun ? 'DRY RUN' : 'REAL'})`);
  const itemIds = only ? [only] : (await getAllItemIds()).slice(0, limit);
  let products = 0, variants = 0, errors = 0;
  for (const itemId of itemIds) {
    try {
      const result = await migrateItem(itemId, dryRun);
      if (!result.skipped) { products++; variants += result.variants; }
    } catch (error: any) {
      errors++;
      console.error(`ERROR ${itemId}: ${error.message}`);
    }
  }
  console.log(`\nProductos con variantes: ${products}`);
  console.log(`Variantes procesadas: ${variants}`);
  console.log(`Errores: ${errors}`);
  if (errors) process.exitCode = 1;
}

main().catch((error) => { console.error('ERROR FATAL:', error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
