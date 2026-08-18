#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  uploadToMinio,
  generateImageKey,
} from '../src/services/minioClient';

const prisma = new PrismaClient();

const OAUTH_FILE = path.resolve(process.cwd(), '.oauth/ml-tokens.json');
const ML_API = 'https://api.mercadolibre.com';
const MAX_IMAGES = 5;
const PAGE_SIZE = 50;

const KNOWN_BRANDS = [
  'Davines',
  'Elgon',
  'Wella',
  "L'Oreal",
  'Loreal',
  'Schwarzkopf',
  'Redken',
  'Matrix',
  'Joico',
  'Revlon',
  'Olaplex',
  'Bonmetique',
  'Mood',
  'Kevin Murphy',
  'Paul Mitchell',
  'Bumble and bumble',
];

const CATEGORY_RULES: [string, string[]][] = [
  [
    'Coloración',
    [
      'tintura',
      'tinte',
      'color',
      'alchemic',
      'moda&styling',
      'modastyling',
      'get the color',
      'dolce',
    ],
  ],
  ['Shampoo', ['shampoo', 'champú', 'champu']],
  [
    'Acondicionador',
    ['acondicionador', 'conditioner', 'balsam', 'oi milk'],
  ],
  [
    'Tratamientos',
    ['mask', 'máscara', 'mascarilla', 'treatment', 'repair', 'bond', 'olaplex'],
  ],
  [
    'Keratina',
    ['keratina', 'keratin', 'btx', 'botox capilar'],
  ],
  [
    'Styling',
    [
      'styling',
      'pomada',
      'gel',
      'cera',
      'wax',
      'spray',
      'mist',
      'mousse',
      'serum',
      'oil',
      'fluido',
    ],
  ],
  [
    'Oxidantes',
    ['oxi', 'oxidante', 'peroxide', 'revelador'],
  ],
  [
    'Herramientas',
    ['plancha', 'secador', 'rizador', 'cepillo', 'peine', 'tijera'],
  ],
];

function getToken(): string {
  if (!fs.existsSync(OAUTH_FILE)) {
    throw new Error(`No existe ${OAUTH_FILE}`);
  }

  const data = JSON.parse(fs.readFileSync(OAUTH_FILE, 'utf8'));

  if (!data.access_token) {
    throw new Error('No existe access_token en ml-tokens.json');
  }

  return data.access_token;
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

function extractBrand(title: string): string {
  for (const brand of KNOWN_BRANDS) {
    if (title.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }

  const parts = title.split(' - ');

  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim();

    if (last.length > 1 && last.length < 40) {
      return last;
    }
  }

  return 'Sin marca';
}

function detectCategory(title: string): string {
  const t = title.toLowerCase();

  for (const [category, keywords] of CATEGORY_RULES) {
    if (keywords.some((keyword) => t.includes(keyword))) {
      return category;
    }
  }

  return 'Cuidado Capilar';
}

function cleanName(title: string, brand: string): string {
  let name = title.trim();

  const suffix = ` - ${brand}`;

  if (name.toLowerCase().endsWith(suffix.toLowerCase())) {
    name = name.slice(0, -suffix.length).trim();
  }

  return name;
}

async function mlFetch(url: string) {
  const token = getToken();

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'DivinittysImporter/1.0',
    },
    signal: AbortSignal.timeout(30000),
  });

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (response.status === 401) {
    throw new Error(
      'MercadoLibre respondió 401: access_token expirado o inválido. Hay que renovar OAuth.'
    );
  }

  if (!response.ok) {
    throw new Error(
      `MercadoLibre HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function getAllItemIds(): Promise<string[]> {
  const result: string[] = [];

  let offset = 0;

  while (true) {
    console.log(`   Buscando publicaciones offset=${offset}...`);

    const data = await mlFetch(
      `https://api.mercadolibre.com/users/55783347/items/search?limit=${PAGE_SIZE}&offset=${offset}`
    );

    const items = data.results || [];

    result.push(...items);

    if (
      items.length < PAGE_SIZE ||
      result.length >= Number(data.paging?.total || result.length)
    ) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return [...new Set(result)];
}

async function getOrCreateCategory(name: string): Promise<string> {
  const slug = toSlug(name);

  const existing = await prisma.category.findFirst({
    where: { slug },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.category.create({
    data: {
      name,
      slug,
      isActive: true,
    },
  });

  return created.id;
}

async function getOrCreateBrand(name: string): Promise<string | null> {
  if (!name || name === 'Sin marca') {
    return null;
  }

  const slug = toSlug(name);

  const existing = await prisma.brand.findFirst({
    where: { slug },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.brand.create({
    data: {
      name,
      slug,
      isActive: true,
    },
  });

  return created.id;
}

async function downloadImage(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Image HTTP ${response.status}`);
  }

  const contentType =
    (response.headers.get('content-type') || 'image/jpeg').split(';')[0];

  if (!contentType.startsWith('image/')) {
    throw new Error(`Contenido no es imagen: ${contentType}`);
  }

  const body = Buffer.from(await response.arrayBuffer());

  if (!body.length) {
    throw new Error('Imagen vacía');
  }

  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  const ext = extMap[contentType] || 'jpg';

  return {
    body,
    contentType,
    ext,
  };
}

async function importItem(itemId: string, dryRun: boolean) {
  const data = await mlFetch(
    `${ML_API}/items/${encodeURIComponent(itemId)}`
  );

  const title = String(data.title || '').trim();

  if (!title) {
    throw new Error('Producto sin título');
  }

  const price = Number(data.price || 0);

  if (price <= 0) {
    throw new Error(`Precio inválido: ${price}`);
  }

  const brand = extractBrand(title);
  const category = detectCategory(title);
  const name = cleanName(title, brand);

  const sku = `ML-${itemId}`;
  const slug = `${toSlug(name)}-${itemId.toLowerCase()}`;

  let stock = Number(data.available_quantity || 0);

  if (Array.isArray(data.variations) && data.variations.length) {
    const variationStock = data.variations.reduce(
      (sum: number, variation: any) =>
        sum + Number(variation.available_quantity || 0),
      0
    );

    if (variationStock > 0) {
      stock = variationStock;
    }
  }

  const active = data.status === 'active';

  console.log(`\n▶ ${itemId}`);
  console.log(`  ${title}`);
  console.log(`  Marca: ${brand}`);
  console.log(`  Categoría: ${category}`);
  console.log(`  Precio: ${price}`);
  console.log(`  Stock: ${stock}`);
  console.log(`  Estado: ${data.status}`);
  console.log(`  Imágenes ML: ${data.pictures?.length || 0}`);

  const existing = await prisma.product.findFirst({
    where: {
      OR: [
        { sku },
        { slug },
      ],
    },
    include: {
      inventory: true,
      images: true,
    },
  });

  if (dryRun) {
    console.log(
      existing
        ? '  🟡 EXISTENTE — se actualizaría'
        : '  🟢 NUEVO — se crearía'
    );

    return {
      created: existing ? 0 : 1,
      updated: existing ? 1 : 0,
      images: 0,
    };
  }

  const categoryId = await getOrCreateCategory(category);
  const brandId = await getOrCreateBrand(brand);

  let productId: string;

  if (existing) {
    const updated = await prisma.product.update({
      where: { id: existing.id },
      data: {
        name,
        basePrice: price,
        isActive: active,
        categoryId,
        brandId,
        description: title,
        tags: [
          category.toLowerCase(),
          brand.toLowerCase(),
          'mercadolibre',
        ],
      },
    });

    productId = updated.id;

    if (existing.inventory) {
      await prisma.inventory.update({
        where: {
          productId,
        },
        data: {
          stock,
        },
      });
    } else {
      await prisma.inventory.create({
        data: {
          productId,
          stock,
          lowStockThreshold: 5,
          trackStock: true,
        },
      });
    }

    console.log(`  🔄 Producto actualizado: ${productId}`);
  } else {
    const created = await prisma.product.create({
      data: {
        sku,
        name,
        slug,
        description: title,
        basePrice: price,
        isActive: active,
        isFeatured: false,
        isOnSale: false,
        tags: [
          category.toLowerCase(),
          brand.toLowerCase(),
          'mercadolibre',
        ],
        categoryId,
        brandId,
        inventory: {
          create: {
            stock,
            lowStockThreshold: 5,
            trackStock: true,
          },
        },
      },
    });

    productId = created.id;

    console.log(`  🆕 Producto creado: ${productId}`);
  }

  /*
   * IMPORTACIÓN DE IMÁGENES
   *
   * Máximo 5 por producto.
   */

  const pictures = Array.isArray(data.pictures)
    ? data.pictures
        .map((p: any) => p.secure_url || p.url)
        .filter(Boolean)
        .slice(0, MAX_IMAGES)
    : [];

  let imageCount = 0;

  for (let i = 0; i < pictures.length; i++) {
    try {
      const sourceUrl = pictures[i];

      const image = await downloadImage(sourceUrl);

      const key = generateImageKey(
        `ml-${itemId}-${i}`,
        image.ext
      );

      const publicUrl = await uploadToMinio(
        key,
        image.body,
        image.contentType
      );

      const existingImage = await prisma.productImage.findFirst({
        where: {
          productId,
          sortOrder: i,
        },
      });

      if (existingImage) {
        await prisma.productImage.update({
          where: {
            id: existingImage.id,
          },
          data: {
            url: publicUrl,
            alt: title,
            isMain: i === 0,
          },
        });
      } else {
        await prisma.productImage.create({
          data: {
            productId,
            url: publicUrl,
            alt: title,
            sortOrder: i,
            isMain: i === 0,
          },
        });
      }

      imageCount++;

      console.log(
        `  📷 Imagen ${i + 1}/${pictures.length}`
      );
    } catch (err: any) {
      console.error(
        `  ⚠️ Error imagen ${i + 1}: ${err.message}`
      );
    }
  }

  /*
   * Mantener imageUrl sincronizada con la imagen principal.
   */

  const mainImage = await prisma.productImage.findFirst({
    where: {
      productId,
      isMain: true,
    },
    orderBy: {
      sortOrder: 'asc',
    },
  });

  if (mainImage) {
    await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        imageUrl: mainImage.url,
      },
    });
  }

  return {
    created: existing ? 0 : 1,
    updated: existing ? 1 : 0,
    images: imageCount,
  };
}

async function main() {
  const args = process.argv.slice(2);

  const dryRun = args.includes('--dry-run');

  const limitArg = args.find((a) =>
    a.startsWith('--limit=')
  );

  const limit = limitArg
    ? Number(limitArg.split('=')[1])
    : 999999;

  console.log('\n');
  console.log('════════════════════════════════════════════');
  console.log(' DIVINITTYS — MIGRACIÓN MERCADOLIBRE');
  console.log('════════════════════════════════════════════');

  console.log(
    `Modo: ${dryRun ? 'DRY RUN' : 'IMPORTACIÓN REAL'}`
  );

  const token = getToken();

  console.log(`OAuth token: OK (${token.length} caracteres)`);

  console.log('\nObteniendo publicaciones de MercadoLibre...');

  const itemIds = await getAllItemIds();

  console.log(`\nTOTAL PUBLICACIONES: ${itemIds.length}`);

  const selected = itemIds.slice(0, limit);

  console.log(`PUBLICACIONES A PROCESAR: ${selected.length}`);

  let created = 0;
  let updated = 0;
  let images = 0;
  let errors = 0;

  for (let i = 0; i < selected.length; i++) {
    const itemId = selected[i];

    console.log(
      `\n[${i + 1}/${selected.length}]`
    );

    try {
      const result = await importItem(
        itemId,
        dryRun
      );

      created += result.created;
      updated += result.updated;
      images += result.images;
    } catch (err: any) {
      errors++;

      console.error(
        `  ❌ ERROR ${itemId}: ${err.message}`
      );
    }
  }

  console.log('\n');
  console.log('════════════════════════════════════════════');
  console.log(' RESULTADO');
  console.log('════════════════════════════════════════════');

  console.log(`Nuevos:       ${created}`);
  console.log(`Actualizados: ${updated}`);
  console.log(`Imágenes:     ${images}`);
  console.log(`Errores:      ${errors}`);

  if (dryRun) {
    console.log('\n🧪 DRY RUN: no se modificó la base de datos.');
  } else {
    console.log('\n✅ Migración finalizada.');
  }
}

main()
  .catch((err) => {
    console.error('\n❌ ERROR FATAL:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

