import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { generateImageKey, getBucketName, uploadToMinio } from '../src/services/minioClient';

type Row = {
  sku: string;
  url: string;
  isMain?: string;
  alt?: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const file = args.find((arg) => arg.startsWith('--file='))?.split('=')[1];
  if (!file) {
    throw new Error('Uso: npx tsx scripts/import-product-images.ts --file=./data/images.csv');
  }
  return { file };
}

function parseCsv(content: string): Row[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((item) => item.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((item) => item.trim());
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
    return row as Row;
  });
}

function getExtensionFromContentType(contentType: string | null) {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';
  return 'jpg';
}

async function main() {
  const { file } = parseArgs();
  const fullPath = path.resolve(process.cwd(), file);
  const content = await fs.readFile(fullPath, 'utf8');
  const rows = parseCsv(content);

  if (!rows.length) {
    throw new Error('CSV vacío o inválido. Esperado: sku,url,isMain,alt');
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.sku || !row.url) {
      skipped += 1;
      continue;
    }

    const product = await prisma.product.findUnique({
      where: { sku: row.sku },
      include: { images: true },
    });

    if (!product) {
      console.warn(`[images] SKU no encontrado: ${row.sku}`);
      skipped += 1;
      continue;
    }

    try {
      const res = await fetch(row.url);
      if (!res.ok) {
        console.warn(`[images] Descarga fallida ${row.sku}: ${res.status} ${row.url}`);
        skipped += 1;
        continue;
      }

      const contentType = res.headers.get('content-type');
      if (!contentType?.startsWith('image/')) {
        console.warn(`[images] URL no es imagen para ${row.sku}: ${row.url}`);
        skipped += 1;
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      const key = generateImageKey(product.id, getExtensionFromContentType(contentType));
      const publicUrl = await uploadToMinio(key, buffer, contentType, getBucketName());
      const isMain = row.isMain === 'true' || product.images.length === 0;

      if (isMain) {
        await prisma.productImage.updateMany({
          where: { productId: product.id, isMain: true },
          data: { isMain: false },
        });
      }

      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: publicUrl,
          alt: row.alt || product.name,
          sortOrder: product.images.length,
          isMain,
        },
      });

      if (isMain || !product.imageUrl) {
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: publicUrl },
        });
      }

      imported += 1;
      console.log(`[images] OK ${row.sku} -> ${publicUrl}`);
    } catch (error) {
      console.warn(`[images] Error en ${row.sku}:`, error);
      skipped += 1;
    }
  }

  console.log(`[images] Importadas: ${imported} | Omitidas: ${skipped}`);
}

main()
  .catch((error) => {
    console.error('[images] Fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
