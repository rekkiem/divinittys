/**
 * src/services/minioClient.ts
 * MinIO S3-compatible client using @aws-sdk/client-s3
 *
 * Infrastructure:
 *   Endpoint: http://localhost:9000  (or MINIO_ENDPOINT:MINIO_PORT)
 *   Access:   minioadmin / minioadmin  (overridable via env)
 *   Bucket:   imagenes                (overridable via MINIO_BUCKET)
 */
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';

// ── Config from environment ─────────────────────────────────────────
const MINIO_ENDPOINT   = process.env.MINIO_ENDPOINT   || 'localhost';
const MINIO_PORT       = process.env.MINIO_PORT        || '9000';
const MINIO_USE_SSL    = process.env.MINIO_USE_SSL     === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY  || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY  || 'minioadmin';
const MINIO_BUCKET     = process.env.MINIO_BUCKET      || 'imagenes';

// Public base URL — used to construct image URLs returned to clients
// Inside Docker: minio:9000. On host: localhost:9000
const MINIO_BASE_URL = `${MINIO_USE_SSL ? 'https' : 'http'}://${MINIO_ENDPOINT}:${MINIO_PORT}`;

// ── S3 Client ───────────────────────────────────────────────────────
export const minioClient = new S3Client({
  region: 'us-east-1',
  endpoint: MINIO_BASE_URL,
  credentials: {
    accessKeyId:     MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
  forcePathStyle: true,  // Required for MinIO
  tls: MINIO_USE_SSL,
});

// ── Bucket bootstrap ────────────────────────────────────────────────
let _bucketReady: Record<string, boolean> = {};

export async function ensureBucketExists(bucket = MINIO_BUCKET): Promise<void> {
  if (_bucketReady[bucket]) return;

  try {
    await minioClient.send(new HeadBucketCommand({ Bucket: bucket }));
    _bucketReady[bucket] = true;
    return;
  } catch (err: any) {
    const is404 =
      err?.$metadata?.httpStatusCode === 404 ||
      err?.name === 'NotFound' ||
      err?.Code === 'NoSuchBucket';

    if (!is404) throw err;
  }

  // Create bucket
  await minioClient.send(new CreateBucketCommand({ Bucket: bucket }));

  // Configure CORS
  await minioClient.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [{
          AllowedHeaders: ['*'],
          AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
          AllowedOrigins: ['*'],
          MaxAgeSeconds: 3000,
        }],
      },
    })
  );

  // Set public-read bucket policy
  await minioClient.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        }],
      }),
    })
  );

  _bucketReady[bucket] = true;
  console.log(`[MinIO] Bucket "${bucket}" created and configured`);
}

// ── Public helpers ──────────────────────────────────────────────────
export function getBucketName(): string {
  return MINIO_BUCKET;
}

/**
 * Build the public URL for a given object key.
 * This URL is accessible directly from the browser.
 *
 * NOTE: In Docker, MINIO_ENDPOINT should be "minio" (internal hostname)
 * but the URL returned to the browser must use "localhost".
 * We handle this by using MINIO_PUBLIC_URL env if set.
 */
export function getPublicUrl(key: string, bucket = MINIO_BUCKET): string {
  // Allow override for Docker environments where internal/external URLs differ
  const publicBase =
    process.env.MINIO_PUBLIC_URL ||
    `${MINIO_USE_SSL ? 'https' : 'http'}://localhost:${MINIO_PORT}`;
  return `${publicBase}/${bucket}/${key}`;
}

/**
 * Upload a file buffer to MinIO and return its public URL.
 */
export async function uploadToMinio(
  key: string,
  body: Buffer | Uint8Array,
  contentType = 'application/octet-stream',
  bucket = MINIO_BUCKET
): Promise<string> {
  await ensureBucketExists(bucket);

  await minioClient.send(
    new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        body,
      ContentType: contentType,
      // Note: ACL 'public-read' requires bucket versioning disabled.
      // We rely on bucket policy for public access instead.
    })
  );

  return getPublicUrl(key, bucket);
}

/**
 * Generate a unique object key for a product image.
 */
export function generateImageKey(
  productId: string,
  ext: string
): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `products/${productId}/${ts}-${rand}.${ext}`;
}
