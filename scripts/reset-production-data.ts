/**
 * scripts/reset-production-data.ts
 *
 * Limpieza segura de datos de prueba para partida limpia en producción.
 * Preserva: ADMIN / SUPER_ADMIN, Vendor, Productos, Categorías, Marcas, Settings.
 *
 * Uso:
 *   npx tsx scripts/reset-production-data.ts              # dry-run (default)
 *   npx tsx scripts/reset-production-data.ts --confirm    # ejecuta borrado
 *
 * En VPS (recomendado):
 *   docker compose -f docker-compose.prod.yml --env-file .env.production exec app \
 *     npx tsx scripts/reset-production-data.ts --confirm
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONFIRM = process.argv.includes('--confirm');
const DRY = !CONFIRM;

type CountMap = Record<string, number>;

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(' DIVINITTYS — reset-production-data');
  console.log(` Modo: ${DRY ? 'DRY-RUN (sin cambios)' : '⚠️  CONFIRMED — BORRANDO'}`);
  console.log('═══════════════════════════════════════════════════\n');

  const counts: CountMap = {};

  // ── 1. Contar antes ──────────────────────────────────────────
  const customerIds = (
    await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      select: { id: true },
    })
  ).map((u) => u.id);

  counts.customers = customerIds.length;
  counts.orders = await prisma.order.count();
  counts.orderItems = await prisma.orderItem.count();
  counts.payments = await prisma.payment.count();
  counts.shipments = await prisma.shipment.count();
  counts.shipmentEvents = await prisma.shipmentEvent.count();
  counts.reviews = await prisma.review.count();
  counts.wishlist = await prisma.wishlistItem.count();
  counts.hairProfiles = await prisma.hairProfile.count();
  counts.addresses = await prisma.address.count({
    where: { userId: { in: customerIds.length ? customerIds : ['__none__'] } },
  });
  counts.sessions = await prisma.session.count({
    where: { userId: { in: customerIds.length ? customerIds : ['__none__'] } },
  });
  counts.accounts = await prisma.account.count({
    where: { userId: { in: customerIds.length ? customerIds : ['__none__'] } },
  });
  counts.subscribers = await prisma.subscriber.count();

  console.log('Registros a eliminar (estimado):');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(18)} ${v}`);
  }
  console.log('');

  if (DRY) {
    console.log('→ Dry-run terminado. Ejecuta con --confirm para aplicar.\n');
    return;
  }

  // ── 2. Borrado en orden de dependencias ──────────────────────
  console.log('Borrando…');

  // Shipment events → shipments
  const se = await prisma.shipmentEvent.deleteMany({});
  console.log(`  shipment_events: ${se.count}`);

  const sh = await prisma.shipment.deleteMany({});
  console.log(`  shipments: ${sh.count}`);

  const pay = await prisma.payment.deleteMany({});
  console.log(`  payments: ${pay.count}`);

  const oi = await prisma.orderItem.deleteMany({});
  console.log(`  order_items: ${oi.count}`);

  const ord = await prisma.order.deleteMany({});
  console.log(`  orders: ${ord.count}`);

  const rev = await prisma.review.deleteMany({});
  console.log(`  reviews: ${rev.count}`);

  const wl = await prisma.wishlistItem.deleteMany({});
  console.log(`  wishlist_items: ${wl.count}`);

  const hp = await prisma.hairProfile.deleteMany({});
  console.log(`  hair_profiles: ${hp.count}`);

  if (customerIds.length > 0) {
    const addr = await prisma.address.deleteMany({
      where: { userId: { in: customerIds } },
    });
    console.log(`  addresses (customers): ${addr.count}`);

    const sess = await prisma.session.deleteMany({
      where: { userId: { in: customerIds } },
    });
    console.log(`  sessions (customers): ${sess.count}`);

    const acc = await prisma.account.deleteMany({
      where: { userId: { in: customerIds } },
    });
    console.log(`  accounts (customers): ${acc.count}`);

    const cust = await prisma.user.deleteMany({
      where: { role: 'CUSTOMER' },
    });
    console.log(`  users CUSTOMER: ${cust.count}`);
  } else {
    console.log('  (sin customers)');
  }

  const sub = await prisma.subscriber.deleteMany({});
  console.log(`  subscribers: ${sub.count}`);

  // No tocamos: products, categories, brands, inventory, settings,
  // coupons (opcional), promotions, vendors, ADMIN/SUPER_ADMIN users.

  console.log('\n✅ Limpieza completada. Productos, admins y vendors intactos.\n');
}

main()
  .catch((e) => {
    console.error('ERROR:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
