import { NextRequest } from 'next/server';

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function cleanup(now: number) {
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

export function rateLimit(req: NextRequest, options: RateLimitOptions) {
  const now = Date.now();
  cleanup(now);

  const bucketKey = `${options.key}:${getRequestIp(req)}`;
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
