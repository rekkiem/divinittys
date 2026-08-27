#!/usr/bin/env npx tsx
/**
 * scripts/ml-competitor-full-audit/index.ts
 * ─────────────────────────────────────────────────────────────────
 * Auditoría de competidores en Mercado Envíos Full — Divinittys
 *
 * Uso:
 *   # Token: export ML_ACCESS_TOKEN desde .oauth (ver README)
 *   npx tsx scripts/ml-competitor-full-audit/index.ts --source=seller --limit=15 --max-pages=1
 *   npx tsx scripts/ml-competitor-full-audit/index.ts --source=prisma --limit=50
 *   npx tsx scripts/ml-competitor-full-audit/index.ts --demo
 *
 * Nota: /sites/MLC/search suele responder 403 (PolicyAgent).
 * Los productos propios se cargan por /users/{id}/items/search (API privada).
 * Competidores: site search si está permitido; si no, products/search por GTIN.
 */

import { CONFIG } from './config';
import { MlApiClient } from './clients/ml-api';
import { buildSearchQueries } from './sources/identifiers';
import {
  loadOurProducts,
  type ProductSource,
} from './sources/our-products';
import {
  extractFullCompetitors,
  findCompetitorsFallback,
} from './filters/full-competitors';
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
        '   En Git Bash (Windows):\n' +
        '   export ML_ACCESS_TOKEN=$(python -c "import json; print(json.load(open(\'.oauth/ml-tokens.json\'))[\'access_token\'])")\n' +
        '   Validar: curl users/me debe ser HTTP 200.\n'
    );
  } else if (token) {
    console.log(`   Token: OK (len=${token.length}, ${token.slice(0, 12)}…)`);
  }

  const products = await loadOurProducts(source, client, { limit });
  console.log(`\n📦 Productos propios a escanear: ${products.length}`);

  if (source === 'seller' && products.length === 0) {
    console.warn(
      '   Sin productos del seller. Revisá token y /users/{id}/items/search.'
    );
  }

  const allAlerts: CompetitorHit[] = [];
  const seen = new Set<string>();
  let warnedSiteSearch = false;

  for (const product of products) {
    process.stdout.write(`  · ${product.title.slice(0, 55)}… `);

    let foundForProduct = 0;

    // 1) Intento search público por queries (si no está bloqueado)
    if (!client.siteSearchBlocked) {
      const queries = buildSearchQueries(product);
      for (const { q, matchedBy } of queries) {
        if (client.siteSearchBlocked) break;
        for (let page = 0; page < maxPages; page++) {
          const offset = page * CONFIG.searchLimit;
          let data: any;
          try {
            data = await client.search(q, offset);
          } catch (e: any) {
            if (!warnedSiteSearch && client.siteSearchBlocked) {
              console.log(
                '\n   ℹ️  /sites/MLC/search bloqueado (403). Usando fallback GTIN/catálogo.'
              );
              warnedSiteSearch = true;
            } else if (!client.siteSearchBlocked) {
              console.error(`\n    ✗ search "${q}": ${e.message}`);
            }
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
    }

    // 2) Fallback: GTIN → catálogo → ítems Full de terceros
    if (client.siteSearchBlocked || foundForProduct === 0) {
      const fb = await findCompetitorsFallback(client, product);
      for (const h of fb) {
        const key = `${h.itemId}:${h.ourProductId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allAlerts.push(h);
        foundForProduct++;
      }
    }

    console.log(foundForProduct > 0 ? `⚠ ${foundForProduct} Full` : 'ok');
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
  if (client.siteSearchBlocked) {
    console.log(
      '   Modo búsqueda: fallback GTIN/catálogo (site search 403)'
    );
  }
  console.log(`   JSON → ${jsonPath}`);
  console.log(`   CSV  → ${csvPath}`);
  console.log('');
}

main().catch((e) => {
  console.error('\n❌ Error fatal:', e);
  process.exit(1);
});
