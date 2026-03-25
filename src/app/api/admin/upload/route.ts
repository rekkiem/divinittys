/**
 * POST /api/admin/upload
 * Uploads product images to MinIO (or local /public/uploads as fallback).
 * Returns the public URL to use in Product.images.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

// ── MinIO client (lazy init) ──────────────────────────────────────
async function getMinioClient() {
  try {
    const { default: Minio } = await import('minio');
    const client = new Minio.Client({
      endPoint:  process.env.MINIO_ENDPOINT || 'localhost',
      port:      parseInt(process.env.MINIO_PORT || '9000'),
      useSSL:    process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'divinittys_admin',
      secretKey: process.env.MINIO_SECRET_KEY || 'divinittys_secret_2024',
    });
    return client;
  } catch {
    return null;
  }
}

const BUCKET = process.env.MINIO_BUCKET || 'divinittys-products';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const MINIO_PUBLIC = `${process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'}://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`;

export async function POST(req: NextRequest) {
  const { user, error } = await withAdmin(req);
  if (error) return error;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const productId = formData.get('productId') as string | null;
    const isMain = formData.get('isMain') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate type and size
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido. Use JPEG, PNG o WebP.' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo supera el límite de 5MB.' }, { status: 400 });
    }

    const ext       = file.type.split('/')[1].replace('jpeg', 'jpg');
    const filename  = `products/${productId || 'general'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer    = Buffer.from(await file.arrayBuffer());

    let publicUrl: string;

    // Try MinIO first
    const minio = await getMinioClient();
    if (minio) {
      try {
        // Ensure bucket exists
        const bucketExists = await minio.bucketExists(BUCKET);
        if (!bucketExists) {
          await minio.makeBucket(BUCKET, 'us-east-1');
          // Set public read policy
          const policy = JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow', Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${BUCKET}/*`],
            }],
          });
          await minio.setBucketPolicy(BUCKET, policy);
        }
        await minio.putObject(BUCKET, filename, buffer, buffer.length, { 'Content-Type': file.type });
        publicUrl = `${MINIO_PUBLIC}/${BUCKET}/${filename}`;
      } catch (e) {
        console.warn('[Upload] MinIO failed, falling back to local:', e);
        publicUrl = await saveLocally(buffer, filename, ext);
      }
    } else {
      publicUrl = await saveLocally(buffer, filename, ext);
    }

    // If productId provided, save to DB
    if (productId) {
      // If isMain, unset existing main image
      if (isMain) {
        await prisma.productImage.updateMany({
          where: { productId, isMain: true },
          data: { isMain: false },
        });
      }
      const existing = await prisma.productImage.count({ where: { productId } });
      await prisma.productImage.create({
        data: {
          productId,
          url: publicUrl,
          alt: file.name.replace(/\.[^.]+$/, ''),
          isMain: isMain || existing === 0,
          sortOrder: existing,
        },
      });
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (e: any) {
    console.error('[Upload] Error:', e);
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 });
  }
}

async function saveLocally(buffer: Buffer, filename: string, ext: string): Promise<string> {
  const { writeFile, mkdir } = await import('fs/promises');
  const { join } = await import('path');
  const localDir  = join(process.cwd(), 'public', 'uploads', 'products');
  const localName = `${Date.now()}.${ext}`;
  await mkdir(localDir, { recursive: true });
  await writeFile(join(localDir, localName), buffer);
  return `/uploads/products/${localName}`;
}
