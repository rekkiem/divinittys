import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { minioClient } from '@/services/minioClient';
import { logger } from '@/lib/logger';

function streamToWeb(readable: NodeJS.ReadableStream) {
  return new ReadableStream({
    start(controller) {
      readable.on('data', (chunk) => controller.enqueue(chunk));
      readable.on('end', () => controller.close());
      readable.on('error', (error) => controller.error(error));
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { bucket: string; key: string[] } }
) {
  try {
    const key = params.key.join('/');
    const result = await minioClient.send(
      new GetObjectCommand({
        Bucket: params.bucket,
        Key: key,
      })
    );

    if (!result.Body) {
      return new NextResponse('Not found', { status: 404 });
    }

    return new NextResponse(streamToWeb(result.Body as NodeJS.ReadableStream), {
      status: 200,
      headers: {
        'Content-Type': result.ContentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    logger.warn('media.fetch_failed', {
      bucket: params.bucket,
      key: params.key.join('/'),
      error: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse('Not found', { status: 404 });
  }
}
