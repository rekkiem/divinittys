#!/usr/bin/env npx tsx
/**
 * scripts/ml-competitor-full-audit/index.ts
 * ─────────────────────────────────────────────────────────────────
 * Auditoría de competidores en Mercado Envíos Full — Divinittys
 *
 * Uso:
 *   npx tsx scripts/ml-competitor-full-audit/index.ts --demo
 *   ML_ACCESS_TOKEN=APP_USR-... npx tsx scripts/ml-competitor-full-audit/index.ts --source=seller
 *   DATABASE_URL=... npx tsx scripts/ml-competitor-full-audit/index.ts --source=prisma --limit=50
 */

import { CONFIG } from './config';
import { MlApiClient } from './clients/ml-api';
import { buildSearchQueries } from './sources/identifiers';
import {
  loadOurProducts,
  type ProductSource,
} from './sources/our-products';
import { extractFullCompetitors } from './filters/full-competitors';
import { buildReport, writeReport } from './report/generate';
import type { CompetitorHit } from './types';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) =>
    args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

  let source = (get('source') || 'seller') as ProductSource;
  if (args.includes('--demo')) source = 'demo';

  return {
    source,
    limit: Number(get('limit') || 100),
    maxPages: Number(get('max-pages') || CONFIG.maxPagesPerQuery),
  };
}

async function main() {
  const { source, limit, maxPages } = parseArgs();

  console.log('\n🔍 DIVINITTYS — Auditoría competidores Mercado Envíos Full');
  console.log(`   Fuente: ${source}`);
  console.log(`   Seller propio: ${CONFIG.ourSellerId}`);
  console.log(`   Límite productos: ${limit}`);
  console.log(`   Máx. páginas por query: ${maxPages}`);

  const client = new MlApiClient();
  const token = await client.ensureToken();

  if (!token && source !== 'demo') {
    console.warn(
      '\n⚠️  Sin ML_ACCESS_TOKEN ni archivo .oauth/ml-tokens.json.\n' +
        '   La API /sites/MLC/search suele responder 403 sin token.\n' +
        '   Exportá ML_ACCESS_TOKEN o montá el token OAuth de la app ML.\n'
    );
  }

  const products = await loadOurProducts(source, client, { limit });
  console.log(`\n📦 Productos propios a escanear: ${products.length}`);

  const allAlerts: CompetitorHit[] = [];
  const seen = new Set<string>();

  for (const product of products) {
    const queries = buildSearchQueries(product);
    if (!queries.length) {
      console.log(`  · skip (sin queries): ${product.title.slice(0, 50)}`);
      continue;
    }

    process.stdout.write(`  · ${product.title.slice(0, 55)}… `);

    let foundForProduct = 0;

    for (const { q, matchedBy } of queries) {
      for (let page = 0; page < maxPages; page++) {
        const offset = page * CONFIG.searchLimit;
        let data: any;
        try {
          data = await client.search(q, offset);
        } catch (e: any) {
          console.error(`\n    ✗ search "${q}" offset=${offset}: ${e.message}`);
          break;
        }

        const results = data.results || [];
        if (!results.length) break;

        const hits = extractFullCompetitors(results, product, matchedBy);
        for (const h of hits) {
          const key = `${h.itemId}:${h.ourProductId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          allAlerts.push(h);
          foundForProduct++;
        }

        if (results.length < CONFIG.searchLimit) break;
      }
    }

    console.log(
      foundForProduct > 0 ? `⚠ ${foundForProduct} Full` : 'ok'
    );
  }

  const report = buildReport(products.length, allAlerts);
  const { jsonPath, csvPath } = writeReport(report);

  console.log(`\n${'─'.repeat(50)}`);
  console.log('📊 Resumen');
  console.log(`   Productos escaneados:           ${report.productsScanned}`);
  console.log(
    `   Productos con competidores Full: ${report.summary.productsWithCompetitors}`
  );
  console.log(
    `   Listados competidores Full:      ${report.summary.totalCompetitorListings}`
  );
  console.log(`   JSON → ${jsonPath}`);
  console.log(`   CSV  → ${csvPath}`);
  console.log('');
}

main().catch((e) => {
  console.error('\n❌ Error fatal:', e);
  process.exit(1);
});
