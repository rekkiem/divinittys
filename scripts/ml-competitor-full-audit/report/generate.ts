import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';
import type { AuditReport, CompetitorHit } from '../types';

export function buildReport(
  productsScanned: number,
  alerts: CompetitorHit[]
): AuditReport {
  return {
    generatedAt: new Date().toISOString(),
    ourSellerId: CONFIG.ourSellerId,
    productsScanned,
    alerts,
    summary: {
      productsWithCompetitors: new Set(alerts.map((a) => a.ourProductId)).size,
      totalCompetitorListings: alerts.length,
    },
  };
}

export function writeReport(report: AuditReport): {
  jsonPath: string;
  csvPath: string;
} {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const jsonPath = path.join(
    CONFIG.outputDir,
    `ml-full-competitors-${stamp}.json`
  );
  const csvPath = path.join(
    CONFIG.outputDir,
    `ml-full-competitors-${stamp}.csv`
  );

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const header =
    'ourProductId,ourTitle,itemId,title,price,currency,sellerId,sellerNickname,soldQuantity,freeShipping,matchedBy,permalink\n';
  const rows = report.alerts
    .map((a) =>
      [
        csvEscape(a.ourProductId),
        csvEscape(a.ourTitle),
        csvEscape(a.itemId),
        csvEscape(a.title),
        a.price,
        csvEscape(a.currency),
        a.sellerId,
        csvEscape(a.sellerNickname || ''),
        a.soldQuantity ?? '',
        a.freeShipping,
        csvEscape(a.matchedBy),
        csvEscape(a.permalink),
      ].join(',')
    )
    .join('\n');

  fs.writeFileSync(csvPath, header + rows, 'utf8');
  return { jsonPath, csvPath };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
