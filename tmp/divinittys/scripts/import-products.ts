/**
 * DIVINITTYS - Importador de Productos desde Excel
 * 
 * Uso:
 *   npm run import:products -- --fichas=./data/fichas.xlsx --precios=./data/precios.xlsx
 *   npm run import:products -- --precios=./data/precios.xlsx  (solo actualizar precios)
 * 
 * Formato Archivo 1 - Fichas Técnicas (fichas.xlsx):
 *   SKU | Nombre | Descripción | Categoría | Marca | Peso | [atributos...]
 * 
 * Formato Archivo 2 - Precios y Stock (precios.xlsx):
 *   SKU | Precio | Precio_Comparar | Stock | Activo
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

// ============================================
// Types
// ============================================

type FichaRow = {
  sku: string;
  nombre: string;
  descripcion?: string;
  descripcion_corta?: string;
  categoria: string;
  categoria_padre?: string;
  marca?: string;
  peso?: number;
  tags?: string;
  destacado?: string;
  imagen?: string;
  [key: string]: string | number | undefined;
};

type PrecioRow = {
  sku: string;
  precio: number;
  precio_comparar?: number;
  costo?: number;
  stock?: number;
  stock_minimo?: number;
  activo?: string;
};

type ImportStats = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  categoriesCreated: number;
  brandsCreated: number;
  totalTime: number;
};

// ============================================
// Main Import Function
// ============================================

async function importProducts(fichasPath?: string, preciosPath?: string): Promise<ImportStats> {
  const stats: ImportStats = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    categoriesCreated: 0,
    brandsCreated: 0,
    totalTime: 0,
  };

  const startTime = Date.now();
  console.log('\n🌟 DIVINITTYS - Importador de Productos\n');

  let fichasData: FichaRow[] = [];
  let preciosData: PrecioRow[] = [];

  // Parse Excel files
  if (fichasPath) {
    if (!fs.existsSync(fichasPath)) {
      throw new Error(`Archivo no encontrado: ${fichasPath}`);
    }
    console.log(`📄 Leyendo fichas técnicas: ${fichasPath}`);
    fichasData = parseExcelFile<FichaRow>(fichasPath, normalizeFichaRow);
    console.log(`   → ${fichasData.length} productos encontrados`);
  }

  if (preciosPath) {
    if (!fs.existsSync(preciosPath)) {
      throw new Error(`Archivo no encontrado: ${preciosPath}`);
    }
    console.log(`💰 Leyendo precios y stock: ${preciosPath}`);
    preciosData = parseExcelFile<PrecioRow>(preciosPath, normalizePrecioRow);
    console.log(`   → ${preciosData.length} registros de precios encontrados`);
  }

  // Build price/stock map
  const priceMap = new Map<string, PrecioRow>();
  for (const row of preciosData) {
    if (row.sku) priceMap.set(row.sku.trim().toUpperCase(), row);
  }

  console.log('\n📦 Iniciando importación...\n');

  // Cache for categories and brands to avoid repeated DB calls
  const categoryCache = new Map<string, string>();
  const brandCache = new Map<string, string>();

  // If only prices, update existing products
  if (!fichasPath && preciosPath) {
    console.log('📊 Modo: Solo actualización de precios y stock\n');

    for (const row of preciosData) {
      if (!row.sku) continue;
      try {
        const product = await prisma.product.findUnique({
          where: { sku: row.sku.trim().toUpperCase() },
        });

        if (!product) {
          stats.skipped++;
          continue;
        }

        await prisma.product.update({
          where: { id: product.id },
          data: {
            basePrice: row.precio,
            comparePrice: row.precio_comparar || null,
            costPrice: row.costo || null,
            isActive: isActive(row.activo),
            isOnSale: !!(row.precio_comparar && row.precio_comparar > row.precio),
          },
        });

        if (row.stock !== undefined) {
          await prisma.inventory.upsert({
            where: { productId: product.id },
            update: {
              stock: Number(row.stock),
              lowStockThreshold: Number(row.stock_minimo) || 5,
            },
            create: {
              productId: product.id,
              stock: Number(row.stock),
              lowStockThreshold: Number(row.stock_minimo) || 5,
            },
          });
        }

        stats.updated++;
        if (stats.updated % 50 === 0) process.stdout.write(`   ${stats.updated} actualizados...\r`);
      } catch (e) {
        stats.errors.push(`SKU ${row.sku}: ${e instanceof Error ? e.message : 'Error desconocido'}`);
      }
    }

    stats.totalTime = Date.now() - startTime;
    return stats;
  }

  // Full product import
  for (const row of fichasData) {
    if (!row.sku || !row.nombre) {
      stats.skipped++;
      stats.errors.push(`Fila omitida: sin SKU o nombre`);
      continue;
    }

    const sku = row.sku.trim().toUpperCase();
    const priceData = priceMap.get(sku);

    // Price required for new products
    const price = priceData?.precio || 0;
    if (price <= 0) {
      stats.skipped++;
      stats.errors.push(`SKU ${sku}: precio inválido (${price})`);
      continue;
    }

    try {
      // --- Category ---
      const categoryName = String(row.categoria || 'General').trim();
      const categoryKey = categoryName.toLowerCase();

      if (!categoryCache.has(categoryKey)) {
        const cat = await upsertCategory(categoryName, row.categoria_padre);
        categoryCache.set(categoryKey, cat.id);
        if (cat.isNew) stats.categoriesCreated++;
      }
      const categoryId = categoryCache.get(categoryKey)!;

      // --- Brand ---
      let brandId: string | undefined;
      if (row.marca) {
        const brandName = String(row.marca).trim();
        const brandKey = brandName.toLowerCase();

        if (!brandCache.has(brandKey)) {
          const brand = await upsertBrand(brandName);
          brandCache.set(brandKey, brand.id);
          if (brand.isNew) stats.brandsCreated++;
        }
        brandId = brandCache.get(brandKey);
      }

      // --- Tags ---
      const tags = row.tags
        ? String(row.tags).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
        : [];

      // --- Slug ---
      const baseSlug = slugify(row.nombre);
      const slug = await ensureUniqueSlug(baseSlug, sku);

      // --- Extra attributes ---
      const reservedKeys = new Set([
        'sku', 'nombre', 'descripcion', 'descripcion_corta', 'categoria',
        'categoria_padre', 'marca', 'peso', 'tags', 'destacado', 'imagen',
      ]);
      const attributes = Object.entries(row)
        .filter(([k, v]) => !reservedKeys.has(k) && v !== undefined && v !== '')
        .map(([name, value]) => ({ name: toTitleCase(name), value: String(value) }));

      // --- Upsert Product ---
      const existingProduct = await prisma.product.findUnique({ where: { sku } });

      const productData = {
        name: String(row.nombre).trim(),
        slug,
        description: row.descripcion ? String(row.descripcion).trim() : null,
        shortDescription: row.descripcion_corta ? String(row.descripcion_corta).trim() : null,
        categoryId,
        brandId: brandId || null,
        basePrice: price,
        comparePrice: priceData?.precio_comparar || null,
        costPrice: priceData?.costo || null,
        weight: row.peso ? Number(row.peso) : null,
        tags,
        isFeatured: row.destacado === 'S' || row.destacado === 'SI' || row.destacado === '1',
        isOnSale: !!(priceData?.precio_comparar && priceData.precio_comparar > price),
        isActive: isActive(priceData?.activo),
      };

      let productId: string;

      if (existingProduct) {
        await prisma.product.update({ where: { sku }, data: productData });
        productId = existingProduct.id;
        stats.updated++;
      } else {
        const newProduct = await prisma.product.create({ data: { sku, ...productData } });
        productId = newProduct.id;
        stats.created++;
      }

      // --- Attributes ---
      if (attributes.length > 0) {
        await prisma.productAttribute.deleteMany({ where: { productId } });
        await prisma.productAttribute.createMany({
          data: attributes.map((a) => ({ productId, name: a.name, value: a.value })),
        });
      }

      // --- Inventory ---
      await prisma.inventory.upsert({
        where: { productId },
        update: {
          stock: Number(priceData?.stock) || 0,
          lowStockThreshold: Number(row.stock_minimo) || 5,
        },
        create: {
          productId,
          stock: Number(priceData?.stock) || 0,
          lowStockThreshold: Number(row.stock_minimo) || 5,
        },
      });

      // --- Main image from URL ---
      if (row.imagen) {
        const existing = await prisma.productImage.findFirst({ where: { productId, isMain: true } });
        if (!existing) {
          await prisma.productImage.create({
            data: {
              productId,
              url: String(row.imagen).trim(),
              isMain: true,
              alt: productData.name,
            },
          });
        }
      }

      if ((stats.created + stats.updated) % 25 === 0) {
        process.stdout.write(`   ${stats.created} creados, ${stats.updated} actualizados...\r`);
      }
    } catch (e) {
      stats.errors.push(`SKU ${sku}: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    }
  }

  stats.totalTime = Date.now() - startTime;
  return stats;
}

// ============================================
// Helpers
// ============================================

function parseExcelFile<T>(filePath: string, normalizer: (row: any) => T): T[] {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return raw.map(normalizer).filter((row: any) => row.sku || (row as any).nombre);
}

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function normalizeFichaRow(raw: any): FichaRow {
  const normalized: any = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[normalizeKey(key)] = value;
  }

  return {
    sku: normalized.sku || normalized.codigo || normalized.cod || normalized.code || '',
    nombre: normalized.nombre || normalized.name || normalized.producto || normalized.descripcion_corta || '',
    descripcion: normalized.descripcion || normalized.description || normalized.descripcion_larga || '',
    descripcion_corta: normalized.descripcion_corta || normalized.short_description || '',
    categoria: normalized.categoria || normalized.category || normalized.rubro || normalized.familia || 'General',
    categoria_padre: normalized.categoria_padre || normalized.parent_category || '',
    marca: normalized.marca || normalized.brand || normalized.laboratorio || normalized.fabricante || '',
    peso: normalized.peso || normalized.weight || normalized.gramos || undefined,
    tags: normalized.tags || normalized.etiquetas || normalized.keywords || '',
    destacado: normalized.destacado || normalized.featured || '',
    imagen: normalized.imagen || normalized.image || normalized.url_imagen || normalized.foto || '',
    ...normalized,
  };
}

function normalizePrecioRow(raw: any): PrecioRow {
  const normalized: any = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[normalizeKey(key)] = value;
  }

  return {
    sku: String(normalized.sku || normalized.codigo || normalized.cod || '').trim().toUpperCase(),
    precio: Number(normalized.precio || normalized.price || normalized.precio_venta || normalized.pvp || 0),
    precio_comparar: normalized.precio_comparar || normalized.precio_normal || normalized.precio_lista || undefined,
    costo: normalized.costo || normalized.cost || normalized.precio_costo || undefined,
    stock: normalized.stock || normalized.cantidad || normalized.qty || normalized.existencia || 0,
    stock_minimo: normalized.stock_minimo || normalized.min_stock || 5,
    activo: String(normalized.activo || normalized.active || normalized.estado || 'S'),
  };
}

async function upsertCategory(name: string, parentName?: string) {
  const slug = slugify(name);
  let parentId: string | undefined;

  if (parentName) {
    const parentSlug = slugify(parentName);
    const parent = await prisma.category.upsert({
      where: { slug: parentSlug },
      update: {},
      create: { name: parentName.trim(), slug: parentSlug },
    });
    parentId = parent.id;
  }

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return { id: existing.id, isNew: false };

  const category = await prisma.category.create({
    data: { name: name.trim(), slug, parentId },
  });
  return { id: category.id, isNew: true };
}

async function upsertBrand(name: string) {
  const slug = slugify(name);
  const existing = await prisma.brand.findUnique({ where: { slug } });
  if (existing) return { id: existing.id, isNew: false };

  const brand = await prisma.brand.create({
    data: { name: name.trim(), slug },
  });
  return { id: brand.id, isNew: true };
}

async function ensureUniqueSlug(baseSlug: string, sku: string): Promise<string> {
  let slug = baseSlug;
  let counter = 0;

  while (true) {
    const existing = await prisma.product.findFirst({ where: { slug } });
    if (!existing || existing.sku === sku) break;
    counter++;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toTitleCase(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function isActive(value?: string): boolean {
  if (!value) return true;
  const v = String(value).trim().toUpperCase();
  return !['N', 'NO', '0', 'FALSE', 'INACTIVO', 'INACTIVE'].includes(v);
}

// ============================================
// CLI Runner
// ============================================

async function main() {
  const args = process.argv.slice(2);
  let fichasPath: string | undefined;
  let preciosPath: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--fichas=')) fichasPath = path.resolve(arg.replace('--fichas=', ''));
    if (arg.startsWith('--precios=')) preciosPath = path.resolve(arg.replace('--precios=', ''));
  }

  if (!fichasPath && !preciosPath) {
    console.error('❌ Error: Especifica al menos un archivo\n');
    console.log('Uso:');
    console.log('  npm run import:products -- --fichas=./fichas.xlsx --precios=./precios.xlsx');
    console.log('  npm run import:products -- --precios=./precios.xlsx');
    process.exit(1);
  }

  try {
    const stats = await importProducts(fichasPath, preciosPath);

    console.log('\n\n' + '='.repeat(50));
    console.log('✅ IMPORTACIÓN COMPLETADA\n');
    console.log(`  📦 Productos creados:    ${stats.created}`);
    console.log(`  🔄 Productos actualizados: ${stats.updated}`);
    console.log(`  ⏭️  Productos omitidos:   ${stats.skipped}`);
    console.log(`  🏷️  Categorías creadas:   ${stats.categoriesCreated}`);
    console.log(`  🏷️  Marcas creadas:       ${stats.brandsCreated}`);
    console.log(`  ⏱️  Tiempo total:         ${(stats.totalTime / 1000).toFixed(1)}s`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  ${stats.errors.length} errores:`);
      stats.errors.slice(0, 20).forEach((e) => console.log(`   - ${e}`));
      if (stats.errors.length > 20) console.log(`   ... y ${stats.errors.length - 20} más`);
    }

    console.log('='.repeat(50) + '\n');
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
