#!/usr/bin/env tsx
/**
 * Soft-deactivate productos fuera de categoría de belleza/capilar.
 * NO hace DELETE. Usa isActive=false + tag "fuera-de-categoria".
 *
 * Uso:
 *   npx tsx scripts/soft-deactivate-out-of-category.ts --dry-run
 *   npx tsx scripts/soft-deactivate-out-of-category.ts --confirm
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REJECT_KEYWORDS = [
  'libro', 'montessori', 'bebe', 'bebé', 'sensorial', 'juguete',
  'collar', 'cadena', 'plata 925', 'acero quirurgico', 'acero quirúrgico',
  'anillo', 'pulsera', 'bijou', 'bisuteria', 'bisutería',
  'producto-prueba', 'producto prueba', 'prueba',
];

const ALLOWED_CATEGORY_SLUGS = new Set([
  'coloracion',
  'shampoo',
  'acondicionador',
  'tratamientos',
  'keratina',
  'styling',
  'oxidantes',
  'herramientas',
  'cuidado-capilar',
]);

async function main() {
  const dryRun = !process.argv.includes('--confirm');
  console.log(dryRun ? '🧪 DRY RUN (sin cambios en DB)' : '🚀 CONFIRMAR — se actualizará la DB');

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: { select: { slug: true, name: true } } },
  });

  const toDeactivate: { id: string; sku: string; name: string; reason: string }[] = [];

  for (const p of products) {
    const nameLower = p.name.toLowerCase();
    const slugLower = p.slug.toLowerCase();
    const kwHit = REJECT_KEYWORDS.find(
      (kw) => nameLower.includes(kw) || slugLower.includes(kw)
    );
    const catOk = p.category?.slug ? ALLOWED_CATEGORY_SLUGS.has(p.category.slug) : false;

    if (kwHit || !catOk) {
      toDeactivate.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        reason: kwHit ? `keyword:${kwHit}` : `categoría:${p.category?.name ?? 'sin cat'}`,
      });
    }
  }

  console.log(`\nEncontrados ${toDeactivate.length} productos a desactivar de ${products.length} activos:`);
  for (const t of toDeactivate) {
    console.log(`  - [${t.sku}] ${t.name} (${t.reason})`);
  }

  if (dryRun) {
    console.log('\n💡 Ejecuta con --confirm para aplicar.');
    return;
  }

  for (const t of toDeactivate) {
    const existing = await prisma.product.findUnique({
      where: { id: t.id },
      select: { tags: true },
    });
    const tags = Array.from(new Set([...(existing?.tags ?? []), 'fuera-de-categoria']));
    await prisma.product.update({
      where: { id: t.id },
      data: { isActive: false, tags },
    });
    process.stdout.write('.');
  }
  console.log(`\n✅ ${toDeactivate.length} productos desactivados (isActive=false + tag fuera-de-categoria).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
