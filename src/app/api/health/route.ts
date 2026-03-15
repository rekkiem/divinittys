import { prisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis/client';
import { ok, serverError } from '@/lib/utils/api';

export async function GET() {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;

    const redis = getRedisClient();
    await redis.connect().catch(() => undefined);
    const redisPing = await redis.ping();

    return ok({
      status: 'ok',
      db: 'ok',
      redis: redisPing === 'PONG' ? 'ok' : 'error',
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return serverError(error);
  }
}
