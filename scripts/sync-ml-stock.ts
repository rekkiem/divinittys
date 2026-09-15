import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { type MercadoLibreVariation } from '../src/lib/mercadolibre/variants';

const prisma = new PrismaClient();
const TOKEN_FILE = '/app/.oauth/ml-tokens.json';
const BATCH_SIZE = 20;

type TokenData = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
  scope?: string;
  obtained_at?: string;
};

async function refreshToken(): Promise<string> {
  const data: TokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Faltan ML_CLIENT_ID o ML_CLIENT_SECRET');

  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: data.refresh_token,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`OAuth refresh ${response.status}: ${text}`);
  const updated = JSON.parse(text);
  const newData: TokenData = {
    ...data,
    access_token: updated.access_token,
    refresh_token: updated.refresh_token || data.refresh_token,
    expires_in: updated.expires_in,
    obtained_at: new Date().toISOString(),
  };
  const tmp = `${TOKEN_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(newData, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, TOKEN_FILE);
  return newData.access_token;
}

function tokenExpired(data: TokenData): boolean {
  if (!data.obtained_at) return true;
  return Date.now() >= new Date(data.obtained_at).getTime() + data.expires_in * 1000 - 120000;
}

async function getToken(): Promise<string> {
  const data: TokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  return tokenExpired(data) ? refreshToken() : data.access_token;
}

async function fetchItems(itemIds: string[], token: string): Promise<any[]> {
  const url = `https://api.mercadolibre.com/items?ids=${itemIds.join(',')}`;
  let response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) {
    token = await refreshToken();
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }
  const text = await response.text();
  if (!response.ok) throw new Error(`ML ${response.status}: ${text}`);
  const result = JSON.parse(text);
  if (!Array.isArray(result)) throw new Error(`Respuesta inesperada de ML: ${text.slice(0, 500)}`);
  return result;
}

async function updateAggregateStock(productId: string, tx: any) {
  const variants = await tx.productVariant.findMany({
    where: { productId, isActive: true },
    select: { stock: true },
  });
  if (variants.length === 0) return;
  const stock = variants.reduce((sum: number, v: { stock: number }) => sum + v.stock, 0);
  await tx.inventory.upsert({
    where: { productId },
    update: { stock },
    create: { productId, stock, lowStockThreshold: 5, trackStock: true },
  });
}

function resolveBasePrice(item: any, mlVariants: MercadoLibreVariation[], fallback: number): number {
  if (mlVariants.length === 0) {
    const p = Number(item.price ?? fallback);
    return Number.isFinite(p) && p > 0 ? p : fallback;
  }
  const prices = mlVariants
    .map((v) => Number(v.price ?? item.price ?? 0))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) {
    const p = Number(item.price ?? fallback);
    return Number.isFinite(p) && p > 0 ? p : fallback;
  }
  return Math.min(...prices);
}

async function main() {
  console.log('DIVINITTYS — SYNC MERCADOLIBRE STOCK + PRICE + VARIANTS');
  console.log('(basePrice se omite si isOnSale=true; stock siempre se sincroniza)');
  let token = await getToken();
  const products = await prisma.product.findMany({
    where: { sku: { startsWith: 'ML-MLC' } },
    include: { inventory: true, variants: true },
    orderBy: { sku: 'asc' },
  });
  console.log(`Productos ML: ${products.length}`);

  let updated = 0;
  let unchanged = 0;
  let errors = 0;
  let priceChanged = 0;
  let stockChanged = 0;
  let statusChanged = 0;
  let saleSkipped = 0;

  for (let offset = 0; offset < products.length; offset += BATCH_SIZE) {
    const batch = products.slice(offset, offset + BATCH_SIZE);
    const itemIds = batch.map((p) => p.sku.replace(/^ML-/, ''));
    let items: any[];
    try {
      items = await fetchItems(itemIds, token);
    } catch (error: any) {
      console.error(`Error lote: ${error.message}`);
      errors += batch.length;
      continue;
    }

    for (const result of items) {
      try {
        if (!result || result.code !== 200 || !result.body) {
          errors++;
          continue;
        }
        const item = result.body;
        const product = products.find((p) => p.sku === `ML-${item.id}`);
        if (!product) continue;

        const mlVariants = Array.isArray(item.variations)
          ? (item.variations as MercadoLibreVariation[])
          : [];
        const isActive = item.status === 'active';

        const previousBasePrice = Number(product.basePrice);
        const previousStock = product.inventory?.stock ?? 0;
        const previousActive = product.isActive;
        const newBasePrice = resolveBasePrice(item, mlVariants, previousBasePrice);
        const protectPrice = product.isOnSale === true;
        const mlCatalogProductId =
          item.catalog_product_id != null && String(item.catalog_product_id).trim() !== ''
            ? String(item.catalog_product_id)
            : null;

        await prisma.$transaction(async (tx) => {
          if (mlVariants.length > 0) {
            const seen = new Set<string>();
            for (const variation of mlVariants) {
              const variationId = String(variation.id);
              const variant = await tx.productVariant.findFirst({
                where: {
                  productId: product.id,
                  options: { path: ['variationId'], equals: variationId },
                },
              });
              const stock = Math.max(0, Math.floor(Number(variation.available_quantity ?? 0)));
              const price = Number(variation.price ?? item.price ?? product.basePrice);
              const name =
                Array.isArray(variation.attribute_combinations) &&
                variation.attribute_combinations.length
                  ? variation.attribute_combinations
                      .map((a: any) => String(a.value_name || '').trim())
                      .filter(Boolean)
                      .join(' / ')
                  : `Variante ${variationId}`;
              const sku = `ML-${item.id}-V-${variationId}`;
              const options = {
                source: 'mercadolibre',
                itemId: String(item.id),
                variationId,
                sellerCustomField: variation.seller_custom_field ?? null,
                attributeCombinations: variation.attribute_combinations ?? [],
                pictureIds: Array.isArray(variation.picture_ids)
                  ? variation.picture_ids.map(String)
                  : [],
              };

              if (variant) {
                await tx.productVariant.update({
                  where: { id: variant.id },
                  data: { sku, name, price, stock, options, isActive: true },
                });
              } else {
                await tx.productVariant.create({
                  data: {
                    productId: product.id,
                    sku,
                    name,
                    price,
                    stock,
                    options,
                    isActive: true,
                  },
                });
              }
              seen.add(variationId);
            }

            const current = await tx.productVariant.findMany({
              where: { productId: product.id },
              select: { id: true, options: true },
            });
            for (const variant of current) {
              const variationId =
                typeof variant.options === 'object' &&
                variant.options &&
                'variationId' in variant.options
                  ? String((variant.options as any).variationId)
                  : null;
              if (variationId && !seen.has(variationId)) {
                await tx.productVariant.update({
                  where: { id: variant.id },
                  data: { stock: 0, isActive: false },
                });
              }
            }
            await updateAggregateStock(product.id, tx);
          } else {
            const stock = Math.max(0, Math.floor(Number(item.available_quantity ?? 0)));
            await tx.inventory.upsert({
              where: { productId: product.id },
              update: { stock },
              create: {
                productId: product.id,
                stock,
                lowStockThreshold: 5,
                trackStock: true,
              },
            });
          }

          const productData: Record<string, unknown> = { isActive };
          if (!protectPrice) {
            productData.basePrice = newBasePrice;
          }
          if (mlCatalogProductId) {
            productData.mlCatalogProductId = mlCatalogProductId;
          }
          await tx.product.update({
            where: { id: product.id },
            data: productData,
          });
        });

        const inv = await prisma.inventory.findUnique({
          where: { productId: product.id },
          select: { stock: true },
        });
        const newStock = inv?.stock ?? 0;

        const priceDiff = !protectPrice && Math.abs(newBasePrice - previousBasePrice) > 0.01;
        const stockDiff = newStock !== previousStock;
        const statusDiff = isActive !== previousActive;

        if (protectPrice && Math.abs(newBasePrice - previousBasePrice) > 0.01) {
          saleSkipped++;
          console.log(
            `  [OFERTA] ${product.sku} isOnSale=true -> precio ML ${newBasePrice} ignorado (se mantiene ${previousBasePrice})`,
          );
        }

        if (priceDiff || stockDiff || statusDiff) {
          updated++;
          if (priceDiff) {
            priceChanged++;
            console.log(`  [PRECIO] ${product.sku} ${previousBasePrice} -> ${newBasePrice}`);
          }
          if (stockDiff) {
            stockChanged++;
            console.log(`  [STOCK] ${product.sku} ${previousStock} -> ${newStock}`);
          }
          if (statusDiff) {
            statusChanged++;
            console.log(`  [STATUS] ${product.sku} ${previousActive} -> ${isActive}`);
          }
        } else if (!(protectPrice && Math.abs(newBasePrice - previousBasePrice) > 0.01)) {
          unchanged++;
        }
      } catch (error: any) {
        errors++;
        console.error(`Error ${result?.body?.id || 'item'}: ${error.message}`);
      }
    }
  }

  const variantProducts = await prisma.product.findMany({
    where: { sku: { startsWith: 'ML-MLC' }, variants: { some: {} } },
    include: {
      variants: { where: { isActive: true }, select: { stock: true } },
      inventory: true,
    },
  });
  for (const product of variantProducts) {
    const expected = product.variants.reduce((sum, v) => sum + v.stock, 0);
    if (product.inventory?.stock !== expected) {
      await prisma.inventory.upsert({
        where: { productId: product.id },
        update: { stock: expected },
        create: {
          productId: product.id,
          stock: expected,
          lowStockThreshold: 5,
          trackStock: true,
        },
      });
    }
  }

  console.log('');
  console.log(`Actualizados:             ${updated}`);
  console.log(`  - precio:               ${priceChanged}`);
  console.log(`  - stock:                ${stockChanged}`);
  console.log(`  - status:               ${statusChanged}`);
  console.log(`Oferta (precio omitido):  ${saleSkipped}`);
  console.log(`Sin cambios:              ${unchanged}`);
  console.log(`Errores:                  ${errors}`);
  if (errors > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('ERROR FATAL:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());