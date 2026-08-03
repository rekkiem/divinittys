#!/usr/bin/env tsx
/**
 * scripts/setupMinio.ts
 * Verifies MinIO is accessible and ensures the bucket exists with correct config.
 *
 * Usage:
 *   npx tsx scripts/setupMinio.ts
 *   docker exec divinittys_app npx tsx scripts/setupMinio.ts
 */
import { ensureBucketExists, getBucketName, getPublicUrl, minioClient } from '../src/services/minioClient';
import { HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const BUCKET = getBucketName();

async function main() {
  console.log('\n🔧 DIVINITTYS — MinIO Setup\n');

  const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
  const port     = process.env.MINIO_PORT     || '9000';
  const bucket   = BUCKET;
  const accessKey = process.env.MINIO_ACCESS_KEY || '(not set)';

  console.log(`   Endpoint:   http://${endpoint}:${port}`);
  console.log(`   Access Key: ${accessKey}`);
  console.log(`   Bucket:     ${bucket}\n`);

  // 1. Test connectivity
  try {
    await minioClient.send(new HeadBucketCommand({ Bucket: '_probe_' }));
  } catch (err: any) {
    // Any response (even 404) means MinIO is reachable
    if (err?.$metadata?.httpStatusCode) {
      console.log('   ✅ MinIO reachable');
    } else {
      console.error('   ❌ Cannot connect to MinIO:', err.message);
      console.log('\n💡 Make sure MinIO is running:');
      console.log('   docker compose up -d minio');
      process.exit(1);
    }
  }

  // 2. Create/verify bucket
  try {
    await ensureBucketExists(bucket);
    console.log(`   ✅ Bucket "${bucket}" ready`);
  } catch (err: any) {
    console.error(`   ❌ Bucket setup failed:`, err.message);
    process.exit(1);
  }

  // 3. Count objects
  try {
    const list = await minioClient.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000 })
    );
    const count = list.KeyCount || 0;
    console.log(`   ✅ Objects in bucket: ${count}`);
  } catch {
    console.log('   ℹ️  Could not list objects (bucket may be empty)');
  }

  // 4. Test URL format
  const testUrl = getPublicUrl('products/test/image.jpg', bucket);
  console.log(`\n   Example URL: ${testUrl}`);
  console.log('\n✅ MinIO setup complete. Ready to upload images.\n');
}

main().catch(err => { console.error('\n❌', err); process.exit(1); });
