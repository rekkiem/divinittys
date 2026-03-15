import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedisClient() {
  if (redis) return redis;
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL no configurada');
  }

  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  return redis;
}

export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  await client.connect().catch(() => undefined);
  const value = await client.get(key);
  if (!value) return null;
  return JSON.parse(value) as T;
}

export async function setCache(key: string, value: unknown, ttlSeconds = 60) {
  const client = getRedisClient();
  await client.connect().catch(() => undefined);
  await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}
