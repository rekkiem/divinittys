/**
 * src/lib/env.ts
 * Server-side environment variable validation.
 *
 * 'server-only' ensures this file cannot be imported from Client Components.
 * In Vitest, 'server-only' is mocked to an empty module (see vitest.config.ts).
 */
import 'server-only';

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? '';
}

export const env = {
  // Database
  DATABASE_URL: requireEnv('DATABASE_URL', 'postgresql://divinittys:divinittys_secret@localhost:5432/divinittys'),

  // Auth
  JWT_SECRET:         requireEnv('JWT_SECRET',         'fallback_secret_change_in_production'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET', 'fallback_refresh_secret'),

  // App
  NODE_ENV:        (process.env.NODE_ENV ?? 'development') as 'development' | 'test' | 'production',
  APP_URL:         requireEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),

  // MinIO
  MINIO_ENDPOINT:   process.env.MINIO_ENDPOINT   ?? 'localhost',
  MINIO_PORT:       process.env.MINIO_PORT        ?? '9000',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY  ?? 'minioadmin',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY  ?? 'minioadmin',
  MINIO_BUCKET:     process.env.MINIO_BUCKET      ?? 'imagenes',

  // Search
  MEILISEARCH_URL:     process.env.MEILISEARCH_URL     ?? 'http://localhost:7700',
  MEILISEARCH_API_KEY: process.env.MEILISEARCH_API_KEY ?? '',

  // Payments
  TRANSBANK_ENV:           process.env.TRANSBANK_ENV            ?? 'integration',
  TRANSBANK_COMMERCE_CODE: process.env.TRANSBANK_COMMERCE_CODE  ?? '597055555532',
  TRANSBANK_API_KEY:       process.env.TRANSBANK_API_KEY         ?? '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C',
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',

  // External APIs
  OPENAI_API_KEY:     process.env.OPENAI_API_KEY     ?? '',
  BLUEXPRESS_API_KEY: process.env.BLUEXPRESS_API_KEY ?? '',
  BLUEXPRESS_ACCOUNT: process.env.BLUEXPRESS_ACCOUNT ?? '',

  // Redis
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
} as const;
