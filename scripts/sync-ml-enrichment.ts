/**
 * DIVINITTYS — Sync enriquecimiento ML (Fase 1)
 * - Atributos → ProductAttribute (upsert por productId+name, source=mercadolibre)
 * - Descripción → Product.descriptionMl (nunca pisa Product.description)
 *
 * Uso:
 *   npx tsx scripts/sync-ml-enrichment.ts
 *   npx tsx scripts/sync-ml-enrichment.ts --limit=10
 *   npx tsx scripts/sync-ml-enrichment.ts --dry-run
 *
 * Flags de Setting (opcionales, default true si no existen):
 *   ml_sync_attributes_enabled
 *   ml_sync_description_enabled
 */
import { PrismaClient } from '@prisma/client';
import { MlApiClient } from '../src/lib/mercadolibre/ml-api-client';

const prisma = new PrismaClient();
const BATCH_SIZE = 20;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

async function getSettingBool(key: string, defaultValue: boolean): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return defaultValue;
  const v = row.value.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return defaultValue;
}

function extractAttributes(item: any): { name: string; value: string }[] {
  const attrs = Array.isArray(item?.attributes) ? item.attributes : [];
  const out: { name: string; value: string }[] = [];
  for (const a of attrs) {
    const name = String(a?.name || a?.id || '').trim();
    const value = String(a?.value_name ?? a?.value_id ?? '').trim();
    if (!name || !value) continue;
    // Evitar atributos internos/ocultos poco útiles en ficha
    const id = String(a?.id || '').toUpperCase();
    if (['ITEM_CONDITION', 'SELLER_SKU', 'GTIN', 'EMPTY_GTIN_REASON'].includes(id)) continue;
    out.push({ name, value });
  }
  return out;
}

async function main() {
  console.log('DIVINITTYS — SYNC ML ENRICHMENT (atributos + descripción)');
  if (dryRun) console.log('[DRY-RUN] no se escribirá en DB');

  const syncAttributes = await getSettingBool('ml_sync_attributes_enabled', true);
  const syncDescription = await getSettingBool('ml_sync_description_enabled', true);
  console.log(`Flags: attributes=${syncAttributes} description=${syncDescription}`);

  if (!syncAttributes && !syncDescription) {
    console.log('Ambos flags desactivados. Nada que hacer.');
    return;
  }

  const client = new MlApiClient();
  await client.ensureToken();

  const products = await prisma.product.findMany({
    where: {
      sku: { startsWith: 'ML-MLC' },
      duplicateOfId: null,
    },
    select: {
      id: true,
      sku: true,
      name: true,
      description: true,
      descriptionMl: true,
    },
    orderBy: { sku: 'asc' },
    ...(limit && Number.isFinite(limit) ? { take: limit } : {}),
  });

  console.log(`Productos ML a procesar: ${products.length}${limit ? ` (limit=${limit})` : ''}`);

  let ok = 0;
  let partial = 0;
  let errors = 0;
  let attrsUpserted = 0;
  let descUpdated = 0;

  for (let offset = 0; offset < products.length; offset += BATCH_SIZE) {
    const batch = products.slice(offset, offset + BATCH_SIZE);
    const itemIds = batch.map((p) => p.sku.replace(/^ML-/, ''));

    let items: any[];
    try {
      items = await client.getItems(itemIds);
    } catch (err: any) {
      console.error(`Error lote offset=${offset}: ${err.message}`);
      errors += batch.length;
      continue;
    }

    for (const result of items) {
      const itemId =
        result?.body?.id ||
        (typeof result?.id === 'string' || typeof result?.id === 'number'
          ? result.id
          : null);
      const product = batch.find(
        (p) => p.sku === `ML-${itemId}` || p.sku === `ML-${result?.body?.id}`
      );
      if (!product) continue;

      const item =
        result?.code === 200 && result?.body
          ? result.body
          : result?.id
            ? result
            : null;

      if (!item) {
        errors++;
        console.error(`  [SKIP] ${product.sku}: respuesta ML inválida`);
        if (!dryRun) {
          await prisma.product.update({
            where: { id: product.id },
            data: { mlSyncStatus: 'error', lastMlSyncAt: new Date() },
          });
        }
        continue;
      }

      try {
        let hadError = false;
        let changed = false;

        // --- Atributos ---
        if (syncAttributes) {
          const attrs = extractAttributes(item);
          if (!dryRun) {
            for (const { name, value } of attrs) {
              await prisma.productAttribute.upsert({
                where: {
                  productId_name: { productId: product.id, name },
                },
                create: {
                  productId: product.id,
                  name,
                  value,
                  source: 'mercadolibre',
                },
                update: {
                  value,
                  source: 'mercadolibre',
                },
              });
              attrsUpserted++;
            }
          } else {
            attrsUpserted += attrs.length;
          }
          if (attrs.length > 0) changed = true;
        }

        // --- Descripción ---
        if (syncDescription) {
          try {
            const desc = await client.getDescription(String(item.id));
            const plain = (desc.plain_text || '').trim();
            if (plain) {
              if (!dryRun) {
                await prisma.product.update({
                  where: { id: product.id },
                  data: { descriptionMl: plain },
                });
              }
              descUpdated++;
              changed = true;
            }
          } catch (descErr: any) {
            // 404 = sin descripción en ML; no es error fatal
            if (!String(descErr.message).includes('404')) {
              console.warn(`  [DESC] ${product.sku}: ${descErr.message}`);
              hadError = true;
            }
          }
        }

        if (!dryRun) {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              lastMlSyncAt: new Date(),
              mlSyncStatus: hadError ? 'partial' : 'ok',
            },
          });
        }

        if (hadError) partial++;
        else ok++;

        if (changed) {
          console.log(`  [OK] ${product.sku} — attrs+desc`);
        }
      } catch (err: any) {
        errors++;
        console.error(`  [ERR] ${product.sku}: ${err.message}`);
        if (!dryRun) {
          await prisma.product
            .update({
              where: { id: product.id },
              data: { mlSyncStatus: 'error', lastMlSyncAt: new Date() },
            })
            .catch(() => {});
        }
      }
    }
  }

  console.log('');
  console.log(`OK:              ${ok}`);
  console.log(`Partial:         ${partial}`);
  console.log(`Errores:         ${errors}`);
  console.log(`Attrs upserted:  ${attrsUpserted}`);
  console.log(`Desc actualizadas: ${descUpdated}`);
  if (errors > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('ERROR FATAL:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
