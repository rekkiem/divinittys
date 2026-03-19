import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding DIVINITTYS database...');

  // ── Super Admin ─────────────────────────────────────────
  // FIX: update always ensures role=SUPER_ADMIN even on re-runs
  const adminPassword = await bcrypt.hash('Admin123!@#', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@divinittys.cl' },
    update: {
      // Always enforce SUPER_ADMIN role in case it was changed
      role: Role.SUPER_ADMIN,
      isActive: true,
      name: 'Administrador',
    },
    create: {
      email: 'admin@divinittys.cl',
      name: 'Administrador',
      passwordHash: adminPassword,
      role: Role.SUPER_ADMIN,
      isActive: true,
      emailVerified: new Date(),
    },
  });
  console.log(`  ✓ Admin user: ${admin.email} (role: ${admin.role})`);

  // ── Categories ───────────────────────────────────────────
  const categories = [
    { name: 'Cuidado Capilar', slug: 'cuidado-capilar', sortOrder: 1 },
    { name: 'Coloración',      slug: 'coloracion',      sortOrder: 2 },
    { name: 'Tratamientos',    slug: 'tratamientos',    sortOrder: 3 },
    { name: 'Styling',         slug: 'styling',         sortOrder: 4 },
    { name: 'Keratina',        slug: 'keratina',        sortOrder: 5 },
    { name: 'Maquillaje',      slug: 'maquillaje',      sortOrder: 6 },
    { name: 'Skincare',        slug: 'skincare',        sortOrder: 7 },
    { name: 'Herramientas',    slug: 'herramientas',    sortOrder: 8 },
    { name: 'Accesorios',      slug: 'accesorios',      sortOrder: 9 },
  ];
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: cat,
    });
  }
  console.log(`  ✓ ${categories.length} categories seeded`);

  // ── Brands ───────────────────────────────────────────────
  const brands = [
    { name: 'Wella',        slug: 'wella' },
    { name: 'Loreal',       slug: 'loreal' },
    { name: 'Kerastase',    slug: 'kerastase' },
    { name: 'Schwarzkopf',  slug: 'schwarzkopf' },
    { name: 'Redken',       slug: 'redken' },
    { name: 'Matrix',       slug: 'matrix' },
    { name: 'Joico',        slug: 'joico' },
    { name: 'Revlon',       slug: 'revlon' },
  ];
  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name },
      create: brand,
    });
  }
  console.log(`  ✓ ${brands.length} brands seeded`);

  // ── Settings ─────────────────────────────────────────────
  const settings = [
    { key: 'store_name',               value: 'DIVINITTYS',          type: 'string' },
    { key: 'store_email',              value: 'hola@divinittys.cl',  type: 'string' },
    { key: 'store_phone',              value: '+56 9 xxxx xxxx',     type: 'string' },
    { key: 'store_address',            value: 'Santiago, Chile',      type: 'string' },
    { key: 'currency',                 value: 'CLP',                  type: 'string' },
    { key: 'free_shipping_threshold',  value: '50000',                type: 'number' },
    { key: 'tax_rate',                 value: '0.19',                 type: 'number' },
    { key: 'maintenance_mode',         value: 'false',                type: 'boolean' },
  ];
  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log(`  ✓ ${settings.length} settings seeded`);
  console.log('\n✅ Seed complete!');
  console.log('─────────────────────────────────────────');
  console.log('  Admin: admin@divinittys.cl');
  console.log('  Pass:  Admin123!@#');
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
