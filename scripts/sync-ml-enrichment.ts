/**
 * DIVINITTYS — Sync enriquecimiento ML (Fase 1 + 2 + 3)
 * - Atributos → ProductAttribute
 * - Descripción → Product.descriptionMl
 * - Rating → ratingAverage / ratingCount / ratingLevelsJson
 * - Opiniones → ProductReview (textos individuales de ML)
 *
 * Flags Setting (default true):
 *   ml_sync_attributes_enabled
 *   ml_sync_description_enabled
 *   ml_sync_rating_enabled
 *   ml_sync_reviews_enabled
 */
import { PrismaClient } from '@prisma/client';
import { MlApiClient } from '../src/lib/mercadolibre/ml-api-client';

const prisma = new PrismaClient();
const BATCH_SIZE = 20;
/** Máx. opiniones a guardar por producto (API ML). */
const REVIEWS_PER_PRODUCT = 15;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const cleanupOnly = args.includes('--cleanup-only');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

const JUNK_VALUES = new Set(['', '-1', 'null', 'undefined', 'n/a', 'na', '-']);

const SKIP_ATTR_IDS = new Set([
  'ITEM_CONDITION',
  'SELLER_SKU',
  'GTIN',
  'EMPTY_GTIN_REASON',
  'PRODUCT_FEATURES',
  'IS_FLAMMABLE',
  'HAS_ENERGY_EFFICIENCY_LABEL',
]);

async function getSettingBool(key: string, defaultValue: boolean): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return defaultValue;
  const v = row.value.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return defaultValue;
}

function isJunkValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (JUNK_VALUES.has(v)) return true;
  if (/^-?1$/.test(v)) return true;
  return false;
}

function extractAttributes(item: any): { name: string; value: string }[] {
  const attrs = Array.isArray(item?.attributes) ? item.attributes : [];
  const out: { name: string; value: string }[] = [];
  const seen = new Set<string>();

  for (const a of attrs) {
    const id = String(a?.id || '').toUpperCase();
    if (SKIP_ATTR_IDS.has(id)) continue;

    const name = String(a?.name || a?.id || '').trim();
    let value = String(a?.value_name ?? '').trim();
    if (!value && a?.value_id != null) {
      value = String(a.value_id).trim();
    }

    if (!name || !value || isJunkValue(value)) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ name, value });
  }
  return out;
}

async function cleanupJunkAttributes(): Promise<number> {
  if (dryRun) {
    const count = await prisma.productAttribute.count({
      where: {
        source: 'mercadolibre',
        OR: [{ value: '-1' }, { value: '' }, { value: { equals: 'null' } }],
      },
    });
    console.log(`[DRY-RUN] se eliminarían ~${count} atributos basura`);
    return count;
  }

  const result = await prisma.productAttribute.deleteMany({
    where: {
      source: 'mercadolibre',
      OR: [
        { value: '-1' },
        { value: '' },
        { value: 'null' },
        { value: 'undefined' },
        { value: 'N/A' },
        { value: 'n/a' },
      ],
    },
  });
  console.log(`Limpieza: eliminados ${result.count} atributos basura (-1 / vacíos)`);
  return result.count;
}

function parseRatingPayload(data: any): {
  average: number | null;
  count: number | null;
  levels: Record<string, number> | null;
} {
  if (!data || typeof data !== 'object') {
    return { average: null, count: null, levels: null };
  }
  const average =
    typeof data.rating_average === 'number'
      ? data.rating_average
      : typeof data.stars === 'number'
        ? data.stars
        : null;
  const pagingTotal =
    typeof data.paging?.total === 'number'
      ? data.paging.total
      : typeof data.paging?.kvs_total === 'number'
        ? data.paging.kvs_total
        : null;
  const levelsRaw = data.rating_levels;
  let count: number | null = pagingTotal;
  let levels: Record<string, number> | null = null;
  if (levelsRaw && typeof levelsRaw === 'object') {
    levels = {
      one_star: Number(levelsRaw.one_star ?? 0) || 0,
      two_star: Number(levelsRaw.two_star ?? 0) || 0,
      three_star: Number(levelsRaw.three_star ?? 0) || 0,
      four_star: Number(levelsRaw.four_star ?? 0) || 0,
      five_star: Number(levelsRaw.five_star ?? 0) || 0,
    };
    if (count == null) {
      count =
        levels.one_star +
        levels.two_star +
        levels.three_star +
        levels.four_star +
        levels.five_star;
    }
  }
  return { average, count, levels };
}

/** Extrae opiniones con texto de la respuesta /reviews/item. */
function extractReviewRows(data: any): {
  mlReviewId: string;
  rating: number;
  title: string | null;
  content: string | null;
  authorName: string | null;
  reviewedAt: Date | null;
}[] {
  const list = Array.isArray(data?.reviews) ? data.reviews : [];
  const out: {
    mlReviewId: string;
    rating: number;
    title: string | null;
    content: string | null;
    authorName: string | null;
    reviewedAt: Date | null;
  }[] = [];

  for (const r of list) {
    const mlReviewId = String(r?.id ?? r?.review_id ?? '').trim();
    if (!mlReviewId) continue;

    const rating = Number(r?.rate ?? r?.rating ?? r?.score ?? 0);
    if (!Number.isFinite(rating) || rating < 1) continue;

    const title = (r?.title || r?.headline || '').toString().trim() || null;
    const content =
      (r?.content || r?.comment || r?.text || r?.review || '')
        .toString()
        .trim() || null;
    // Sin texto ni título no aporta valor en UI
    if (!content && !title) continue;

    const authorName =
      (r?.reviewer?.nickname ||
        r?.reviewer?.name ||
        r?.buyer?.nickname ||
        r?.user?.nickname ||
        '')
        .toString()
        .trim() || null;

    let reviewedAt: Date | null = null;
    const rawDate = r?.date_created || r?.created_at || r?.date || null;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!Number.isNaN(d.getTime())) reviewedAt = d;
    }

    out.push({
      mlReviewId,
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      title,
      content,
      authorName,
      reviewedAt,
    });
  }
  return out;
}

async function main() {
  console.log('DIVINITTYS — SYNC ML ENRICHMENT (attrs + desc + rating + reviews)');
  if (dryRun) console.log('[DRY-RUN] no se escribirá en DB');

  await cleanupJunkAttributes();
  if (cleanupOnly) {
    console.log('Solo limpieza (--cleanup-only). Fin.');
    return;
  }

  const syncAttributes = await getSettingBool('ml_sync_attributes_enabled', true);
  const syncDescription = await getSettingBool('ml_sync_description_enabled', true);
  const syncRating = await getSettingBool('ml_sync_rating_enabled', true);
  const syncReviews = await getSettingBool('ml_sync_reviews_enabled', true);
  console.log(
    `Flags: attributes=${syncAttributes} description=${syncDescription} rating=${syncRating} reviews=${syncReviews}`
  );

  if (!syncAttributes && !syncDescription && !syncRating && !syncReviews) {
    console.log('Todos los flags desactivados. Nada que hacer.');
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
  let ratingUpdated = 0;
  let reviewsUpserted = 0;

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
        const parts: string[] = [];

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
          if (attrs.length > 0) {
            changed = true;
            parts.push('attrs');
          }
        }

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
              parts.push('desc');
            }
          } catch (descErr: any) {
            if (!String(descErr.message).includes('404')) {
              console.warn(`  [DESC] ${product.sku}: ${descErr.message}`);
              hadError = true;
            }
          }
        }

        // Rating + reviews (una sola llamada si ambas flags)
        if (syncRating || syncReviews) {
          try {
            const reviewsData = await client.getReviews(String(item.id), {
              offset: 0,
              limit: syncReviews ? REVIEWS_PER_PRODUCT : 1,
            });

            if (syncRating) {
              const { average, count, levels } = parseRatingPayload(reviewsData);
              if (average != null || (count != null && count > 0)) {
                if (!dryRun) {
                  await prisma.product.update({
                    where: { id: product.id },
                    data: {
                      ratingAverage: average,
                      ratingCount: count,
                      ratingLevelsJson: levels ?? undefined,
                    },
                  });
                }
                ratingUpdated++;
                changed = true;
                parts.push(`rating=${average ?? '?'}(${count ?? 0})`);
              }
            }

            if (syncReviews) {
              const rows = extractReviewRows(reviewsData);
              if (!dryRun) {
                for (const row of rows) {
                  await prisma.productReview.upsert({
                    where: {
                      productId_mlReviewId: {
                        productId: product.id,
                        mlReviewId: row.mlReviewId,
                      },
                    },
                    create: {
                      productId: product.id,
                      mlReviewId: row.mlReviewId,
                      rating: row.rating,
                      title: row.title,
                      content: row.content,
                      authorName: row.authorName,
                      reviewedAt: row.reviewedAt,
                    },
                    update: {
                      rating: row.rating,
                      title: row.title,
                      content: row.content,
                      authorName: row.authorName,
                      reviewedAt: row.reviewedAt,
                    },
                  });
                  reviewsUpserted++;
                }
              } else {
                reviewsUpserted += rows.length;
              }
              if (rows.length > 0) {
                changed = true;
                parts.push(`reviews=${rows.length}`);
              }
            }
          } catch (ratingErr: any) {
            const msg = String(ratingErr.message || '');
            if (!msg.includes('404')) {
              console.warn(`  [REVIEWS] ${product.sku}: ${msg}`);
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
          console.log(`  [OK] ${product.sku} — ${parts.join('+') || 'sync'}`);
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
  console.log(`Ratings actualizados: ${ratingUpdated}`);
  console.log(`Reviews upserted: ${reviewsUpserted}`);
  if (errors > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('ERROR FATAL:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
