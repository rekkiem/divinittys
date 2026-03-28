#!/usr/bin/env tsx
/**
 * scripts/fixDeploy.ts
 * Emergency repair script for common deployment issues:
 *
 * 1. Fixes admin user (isActive=true, role=SUPER_ADMIN)
 * 2. Activates all imported products that are inactive
 * 3. Syncs imageUrl from ProductImage records
 *
 * Usage:
 *   docker exec divinittys_app npx tsx scripts/fixDeploy.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔧 DIVINITTYS — Fix Deploy Script\n');

  // 1. Fix admin user
  const adminFix = await prisma.user.updateMany({
    where: { email: 'admin@divinittys.cl' },
    data: { role: 'SUPER_ADMIN', isActive: true },
  });
  console.log(`  ✅ Admin user fixed: ${adminFix.count} user(s) updated`);
  console.log('     → IMPORTANTE: Cierra sesión y vuelve a iniciar en /cuenta/login\n');

  // 2. Activate all inactive products
  const before = await prisma.product.count({ where: { isActive: false } });
  if (before > 0) {
    const activated = await prisma.product.updateMany({
      where: { isActive: false },
      data: { isActive: true },
    });
    console.log(`  ✅ Productos activados: ${activated.count} (estaban inactivos)`);
  } else {
    console.log('  ✅ Todos los productos ya están activos');
  }

  // 3. Sync imageUrl from ProductImage records
  const products = await prisma.product.findMany({
    include: {
      images: { orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }] },
    },
  });

  let synced = 0;
  for (const p of products) {
    const mainImg = p.images.find(i => i.isMain) || p.images[0];
    if (mainImg && p.imageUrl !== mainImg.url) {
      await prisma.product.update({
        where: { id: p.id },
        data: { imageUrl: mainImg.url },
      });
      synced++;
    }
  }
  console.log(`  ✅ imageUrl sincronizado: ${synced} productos\n`);

  console.log('─────────────────────────────────────────');
  console.log('  Fix completado. Próximos pasos:');
  console.log('  1. Cierra sesión en el navegador');
  console.log('  2. Limpia localStorage (F12 → Application → Local Storage → Borrar todo)');
  console.log('  3. Inicia sesión con admin@divinittys.cl / Admin123!@#');
  console.log('  4. Las imágenes deben subirse desde /admin/productos/{slug}/editar');
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch(e => { console.error('\n❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
