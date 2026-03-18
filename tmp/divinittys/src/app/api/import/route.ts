import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, badRequest, serverError } from '@/lib/utils/api';
import { slugify } from '@/lib/utils/api';

type ProductRow = {
  sku: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  marca?: string;
  peso?: number;
  [key: string]: string | number | undefined;
};

type PriceRow = {
  sku: string;
  precio: number;
  precio_comparar?: number;
  stock?: number;
  activo?: string;
};

export async function POST(req: NextRequest) {
  const { user, error } = await withAdmin(req);
  if (error) return error;

  try {

    const formData = await req.formData();
    const fichasFile = formData.get('fichas') as File | null;
    const preciosFile = formData.get('precios') as File | null;

    if (!fichasFile && !preciosFile) {
      return badRequest('Se requiere al menos un archivo Excel');
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
      categories: 0,
      brands: 0,
    };

    let fichasData: ProductRow[] = [];
    let preciosData: PriceRow[] = [];

    // Parse fichas file
    if (fichasFile) {
      const buffer = await fichasFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
      fichasData = normalizeProductRows(raw);
    }

    // Parse precios file
    if (preciosFile) {
      const buffer = await preciosFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
      preciosData = normalizePriceRows(raw);
    }

    // Create price map
    const priceMap = new Map<string, PriceRow>();
    for (const row of preciosData) {
      if (row.sku) priceMap.set(String(row.sku).trim().toUpperCase(), row);
    }

    // If only prices file, update existing products
    if (!fichasFile && preciosFile) {
      for (const row of preciosData) {
        if (!row.sku || !row.precio) continue;

        try {
          const product = await prisma.product.findUnique({
            where: { sku: String(row.sku).trim().toUpperCase() },
          });

          if (product) {
            await prisma.product.update({
              where: { id: product.id },
              data: {
                basePrice: row.precio,
                comparePrice: row.precio_comparar || null,
                isActive: row.activo !== 'N' && row.activo !== 'NO' && row.activo !== '0',
              },
            });

            if (row.stock !== undefined) {
              await prisma.inventory.upsert({
                where: { productId: product.id },
                update: { stock: Number(row.stock) || 0 },
                create: { productId: product.id, stock: Number(row.stock) || 0 },
              });
            }
            results.updated++;
          }
        } catch (e) {
          results.errors.push(`SKU ${row.sku}: ${e instanceof Error ? e.message : 'Error'}`);
        }
      }

      return ok(results);
    }

    // Process full product import
    for (const row of fichasData) {
      if (!row.sku || !row.nombre) {
        results.errors.push(`Fila sin SKU o nombre: ${JSON.stringify(row)}`);
        continue;
      }

      try {
        const sku = String(row.sku).trim().toUpperCase();
        const priceRow = priceMap.get(sku);

        const price = priceRow?.precio || 0;
        if (price <= 0) {
          results.errors.push(`SKU ${sku}: precio inválido`);
          continue;
        }

        // Ensure category exists
        const categoryName = String(row.categoria || 'Sin categoría').trim();
        const categorySlug = slugify(categoryName);

        const category = await prisma.category.upsert({
          where: { slug: categorySlug },
          update: {},
          create: { name: categoryName, slug: categorySlug },
        });

        // Ensure brand exists
        let brand = null;
        if (row.marca) {
          const brandName = String(row.marca).trim();
          const brandSlug = slugify(brandName);
          brand = await prisma.brand.upsert({
            where: { slug: brandSlug },
            update: {},
            create: { name: brandName, slug: brandSlug },
          });
        }

        // Build attributes from extra columns
        const reservedCols = new Set(['sku', 'nombre', 'descripcion', 'categoria', 'marca', 'peso']);
        const attributes = Object.entries(row)
          .filter(([key, val]) => !reservedCols.has(key) && val)
          .map(([name, value]) => ({ name, value: String(value) }));

        // Generate unique slug
        let slug = slugify(row.nombre);
        const existing = await prisma.product.findFirst({ where: { slug } });
        if (existing && existing.sku !== sku) {
          slug = `${slug}-${sku.toLowerCase()}`;
        }

        // Upsert product
        const product = await prisma.product.upsert({
          where: { sku },
          update: {
            name: String(row.nombre).trim(),
            slug,
            description: row.descripcion ? String(row.descripcion).trim() : null,
            categoryId: category.id,
            brandId: brand?.id || null,
            basePrice: price,
            comparePrice: priceRow?.precio_comparar || null,
            weight: row.peso ? Number(row.peso) : null,
            isActive: priceRow?.activo !== 'N' && priceRow?.activo !== 'NO',
          },
          create: {
            sku,
            name: String(row.nombre).trim(),
            slug,
            description: row.descripcion ? String(row.descripcion).trim() : null,
            categoryId: category.id,
            brandId: brand?.id || null,
            basePrice: price,
            comparePrice: priceRow?.precio_comparar || null,
            weight: row.peso ? Number(row.peso) : null,
          },
        });

        // Upsert attributes
        if (attributes.length > 0) {
          await prisma.productAttribute.deleteMany({ where: { productId: product.id } });
          await prisma.productAttribute.createMany({
            data: attributes.map((a) => ({ productId: product.id, name: a.name, value: a.value })),
          });
        }

        // Upsert inventory
        await prisma.inventory.upsert({
          where: { productId: product.id },
          update: { stock: Number(priceRow?.stock) || 0 },
          create: { productId: product.id, stock: Number(priceRow?.stock) || 0 },
        });

        results.created++;
      } catch (e) {
        results.errors.push(`SKU ${row.sku}: ${e instanceof Error ? e.message : 'Error'}`);
      }
    }

    return ok({
      ...results,
      message: `Importación completa: ${results.created} productos creados/actualizados`,
    });
  } catch (error) {
    return serverError(error);
  }
}

// ============================================
// Normalization helpers
// ============================================

function normalizeProductRows(raw: any[]): ProductRow[] {
  return raw.map((row) => {
    const normalized: any = {};
    for (const [key, value] of Object.entries(row)) {
      const normalKey = key.toLowerCase().trim()
        .replace(/\s+/g, '_')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      normalized[normalKey] = value;
    }

    return {
      sku: normalized.sku || normalized.codigo || normalized.cod || '',
      nombre: normalized.nombre || normalized.name || normalized.producto || '',
      descripcion: normalized.descripcion || normalized.description || '',
      categoria: normalized.categoria || normalized.category || normalized.rubro || 'General',
      marca: normalized.marca || normalized.brand || normalized.laboratorio || '',
      peso: normalized.peso || normalized.weight || undefined,
      ...normalized,
    };
  });
}

function normalizePriceRows(raw: any[]): PriceRow[] {
  return raw.map((row) => {
    const normalized: any = {};
    for (const [key, value] of Object.entries(row)) {
      const normalKey = key.toLowerCase().trim()
        .replace(/\s+/g, '_')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      normalized[normalKey] = value;
    }

    return {
      sku: normalized.sku || normalized.codigo || normalized.cod || '',
      precio: Number(normalized.precio || normalized.price || normalized.precio_venta || 0),
      precio_comparar: normalized.precio_comparar || normalized.precio_normal || undefined,
      stock: normalized.stock || normalized.cantidad || normalized.qty || 0,
      activo: normalized.activo || normalized.active || normalized.estado || 'S',
    };
  });
}
