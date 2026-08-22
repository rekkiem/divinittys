/**
 * Uso:
 *   npx tsx scripts/cleanup-abandoned-orders.ts
 *   npx tsx scripts/cleanup-abandoned-orders.ts --minutes=90 --limit=50
 *
 * Docker:
 *   docker exec divinittys_app npx tsx scripts/cleanup-abandoned-orders.ts
 */
import { cancelAbandonedOrders } from '../src/lib/orders/abandoned-orders';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const minutes = arg('minutes');
  const limit = arg('limit');

  const result = await cancelAbandonedOrders({
    olderThanMinutes: minutes ? Number(minutes) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
