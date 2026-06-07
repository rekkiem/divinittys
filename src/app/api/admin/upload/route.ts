/**
 * POST /api/admin/upload
 * Handles product image uploads. Stores files in MinIO and persists URL in DB.
 *
 * Form fields:
 *   file      File     Required. Image file (JPEG, PNG, WebP, GIF). Max 5MB.
 *   productId string?  If provided, creates a ProductImage record in DB.
 *   isMain    string?  'true' to mark as main product image.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sanitizeText } from '@/lib/security/sanitize';
import {
  uploadToMinio,
  generateImageKey,
  getBucketName,
} from '@/services/minioClient';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────
  const { user, error } = await withAdmin(req);
  if (error) return error;

  try {
    const formData  = await req.formData();
    const file      = formData.get('file') as File | null;
    const productId = (formData.get('productId') as string | null)?.trim() || null;
    const isMain    = formData.get('isMain') === 'true';

    // ── Validation ────────────────────────────────────────────────────
    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo (campo: file)' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
      return NextResponse.json(
        { error: `Tipo no permitido: ${file.type}. Use JPEG, PNG, WebP o GIF.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'El archivo supera el límite de 5MB.' }, { status: 400 });
    }

    // ── Upload to MinIO ───────────────────────────────────────────────
    const ext    = file.type.split('/')[1].replace('jpeg', 'jpg');
    const key    = generateImageKey(productId || 'general', ext);
    const buffer = Buffer.from(await file.arrayBuffer());

    const publicUrl = await uploadToMinio(key, buffer, file.type, getBucketName());

    // ── Persist in DB (if productId provided) ────────────────────────
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!product) {
        return NextResponse.json({ error: 'Producto no encontrado para asociar la imagen.' }, { status: 404 });
      }

      // Unset current main image if this one will be main
      if (isMain) {
        await prisma.productImage.updateMany({
          where: { productId, isMain: true },
          data:  { isMain: false },
        });
      }

      const existingCount = await prisma.productImage.count({ where: { productId } });
      const shouldBeMain  = isMain || existingCount === 0;

      await prisma.productImage.create({
        data: {
          productId,
          url:       publicUrl,
          alt:       sanitizeText(file.name.replace(/\.[^.]+$/, '')).slice(0, 150),
          sortOrder: existingCount,
          isMain:    shouldBeMain,
        },
      });

      // Keep imageUrl field in sync with the main image
      if (shouldBeMain) {
        await prisma.product.update({
          where: { id: productId },
          data:  { imageUrl: publicUrl },
        });
      }
    }

    logger.info('upload.image_uploaded', {
      userId: user.id,
      email: user.email,
      productId,
      url: publicUrl,
      contentType: file.type,
      size: file.size,
    });
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    logger.error('upload.failed', { error: err });
    return NextResponse.json(
      { error: err?.message || 'Error interno al subir imagen' },
      { status: 500 }
    );
  }
}
