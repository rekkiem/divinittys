#!/usr/bin/env tsx
/**
 * Reclasifica productos existentes a catalogScope + categoría correcta.
 * NO hace DELETE ni isActive=false.
 *
 * Uso:
 *   npx tsx scripts/reclassify-catalog-scope.ts --dry-run
 *   npx tsx scripts/reclassify-catalog-scope.ts --confirm
 */

import { PrismaClient, CatalogScope } from '@prisma/client';

const prisma = new PrismaClient();

const SECONDARY_RULES: {
  match: RegExp;
  categoryName: string;
  categorySlug: string;
  reason: string;
}[] = [
  {
    match: /libro|montessori|sensorial|bebe|bebé/i,
    categoryName: 'Infantil',
    categorySlug: 'infantil',
    reason: 'infantil/libros',
  },
  {
    match: /collar|cadena|plata\s*925|acero\s*quirurg|acero\s*quirúrg|anillo|pulsera|bijou|bisuter/i,
    categoryName: 'Accesorios',
    categorySlug: 'accesorios',
    reason: 'accesorios/bijou',
  },
];

/** Sublimia / DD cream = cabello (Styling), no Skincare. */
const SUBLIMIA_FIX = {
  match: /sublimia|dd\s*cream|hair\s*dd|dd\s*champ/i,
  categoryName: 'Styling',
  categorySlug: 'styling',
};

async function getOrCreateCategory(name: string, slug: string): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { OR: [{ slug }, { name }] },
  });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: { name, slug, isActive: true },
  });
  return created.id;
}

async function main() {
  const dryRun = !process.argv.includes('--confirm');
  console.log(dryRun ? '🧪 DRY RUN' : '🚀 CONFIRMAR — se actualizará la DB');

  const products = await prisma.product.findMany({
    include: { category: { select: { name: true, slug: true } } },
  });

  type Action = {
    id: string;
    sku: string;
    name: string;
    catalogScope: CatalogScope;
    categoryId?: string;
    categoryLabel?: string;
    note: string;
  };

  const actions: Action[] = [];

  for (const p of products) {
    const hay = `${p.name} ${p.slug}`;

    if (SUBLIMIA_FIX.match.test(hay)) {
      const catId = dryRun
        ? undefined
        : await getOrCreateCategory(SUBLIMIA_FIX.categoryName, SUBLIMIA_FIX.categorySlug);
      actions.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        catalogScope: 'BEAUTY',
        categoryId: catId,
        categoryLabel: SUBLIMIA_FIX.categoryName,
        note: `fix Sublimia → BEAUTY + ${SUBLIMIA_FIX.categoryName} (antes: ${p.category?.name ?? '?'})`,
      });
      continue;
    }

    const rule = SECONDARY_RULES.find((r) => r.match.test(hay));
    if (rule) {
      const catId = dryRun
        ? undefined
        : await getOrCreateCategory(rule.categoryName, rule.categorySlug);
      actions.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        catalogScope: 'SECONDARY',
        categoryId: catId,
        categoryLabel: rule.categoryName,
        note: `SECONDARY (${rule.reason}) → cat ${rule.categoryName}`,
      });
    }
  }

  console.log(`\n${actions.length} productos a actualizar:`);
  for (const a of actions) {
    console.log(`  - [${a.sku}] ${a.name}`);
    console.log(`    → ${a.note}`);
  }

  if (dryRun) {
    console.log('\n💡 Ejecuta con --confirm para aplicar.');
    return;
  }

  for (const a of actions) {
    await prisma.product.update({
      where: { id: a.id },
      data: {
        catalogScope: a.catalogScope,
        ...(a.categoryId ? { categoryId: a.categoryId } : {}),
        isFeatured: a.catalogScope === 'SECONDARY' ? false : undefined,
      },
    });
    process.stdout.write('.');
  }
  console.log(`\n✅ ${actions.length} productos actualizados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
