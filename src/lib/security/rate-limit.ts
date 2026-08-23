import { NextRequest } from 'next/server';

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function cleanupMemory(now: number) {
  for (const [key, bucket] of Array.from(buckets.entries())) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function getRequestIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function rateLimitMemory(bucketKey: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanupMemory(now);

  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    const nextBucket = { count: 1, resetAt: now + options.windowMs };
    buckets.set(bucketKey, nextBucket);
    return { allowed: true, remaining: options.limit - 1, resetAt: nextBucket.resetAt };
  }

  bucket.count += 1;
  buckets.set(bucketKey, bucket);

  return {
    allowed: bucket.count <= options.limit,
    remaining: Math.max(options.limit - bucket.count, 0),
    resetAt: bucket.resetAt,
  };
}

/**
 * Rate limit con Redis (compartido entre workers).
 * Si Redis no está disponible, fallback al Map en memoria.
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const ip = getRequestIp(req);
  const bucketKey = `${options.key}:${ip}`;
  const redisKey = `ratelimit:${bucketKey}`;

  if (!process.env.REDIS_URL) {
    return rateLimitMemory(bucketKey, options);
  }

  try {
    const { getRedisClient } = await import('@/lib/redis/client');
    const client = getRedisClient();
    await client.connect().catch(() => undefined);

    const count = await client.incr(redisKey);
    if (count === 1) {
      await client.pexpire(redisKey, options.windowMs);
    }

    const ttl = await client.pttl(redisKey);
    const resetAt = Date.now() + (ttl > 0 ? ttl : options.windowMs);

    return {
      allowed: count <= options.limit,
      remaining: Math.max(options.limit - count, 0),
      resetAt,
    };
  } catch {
    return rateLimitMemory(bucketKey, options);
  }
}
