/**
 * src/lib/env.ts
 * Server-side environment variable validation.
 *
 * 'server-only' ensures this file cannot be imported from Client Components.
 * In Vitest, 'server-only' is mocked to an empty module (see vitest.config.ts).
 */
import 'server-only';

const isProduction = process.env.NODE_ENV === 'production';

function requireEnv(name: string, developmentFallback?: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return developmentFallback ?? '';
}

function optionalEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Database
  DATABASE_URL: requireEnv('DATABASE_URL'),

  // Auth
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  JWT_EXPIRES_IN: optionalEnv('JWT_EXPIRES_IN', '7d'),
  JWT_REFRESH_EXPIRES_IN: optionalEnv('JWT_REFRESH_EXPIRES_IN', '30d'),

  // App
  NODE_ENV: (process.env.NODE_ENV ?? 'development') as 'development' | 'test' | 'production',
  APP_URL: requireEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),

  // MinIO
  MINIO_ENDPOINT: requireEnv('MINIO_ENDPOINT', 'localhost'),
  MINIO_PORT: optionalEnv('MINIO_PORT', '9000'),
  MINIO_USE_SSL: optionalEnv('MINIO_USE_SSL', 'false'),
  MINIO_ACCESS_KEY: requireEnv('MINIO_ACCESS_KEY'),
  MINIO_SECRET_KEY: requireEnv('MINIO_SECRET_KEY'),
  MINIO_BUCKET: requireEnv('MINIO_BUCKET', 'imagenes'),
  MINIO_PUBLIC_URL: optionalEnv('MINIO_PUBLIC_URL'),

  // Search
  MEILISEARCH_URL: requireEnv('MEILISEARCH_URL', 'http://localhost:7700'),
  MEILISEARCH_API_KEY: requireEnv('MEILISEARCH_API_KEY'),

  // Payments
  TRANSBANK_ENV: optionalEnv('TRANSBANK_ENV', 'integration'),
  TRANSBANK_COMMERCE_CODE: optionalEnv('TRANSBANK_COMMERCE_CODE'),
  TRANSBANK_API_KEY: optionalEnv('TRANSBANK_API_KEY'),
  MERCADOPAGO_ACCESS_TOKEN: optionalEnv('MERCADOPAGO_ACCESS_TOKEN'),
  MERCADOPAGO_PUBLIC_KEY: optionalEnv('MERCADOPAGO_PUBLIC_KEY'),
  MERCADOPAGO_WEBHOOK_SECRET: optionalEnv('MERCADOPAGO_WEBHOOK_SECRET'),

  // External APIs
  OPENAI_API_KEY: optionalEnv('OPENAI_API_KEY'),
  BLUEXPRESS_API_KEY: optionalEnv('BLUEXPRESS_API_KEY'),
  BLUEXPRESS_ACCOUNT: optionalEnv('BLUEXPRESS_ACCOUNT'),

  // Redis
  REDIS_URL: requireEnv('REDIS_URL', 'redis://localhost:6379'),
  REDIS_HOST: optionalEnv('REDIS_HOST'),
  REDIS_PORT: optionalEnv('REDIS_PORT', '6379'),

  // Admin bootstrap
  ADMIN_EMAIL: optionalEnv('ADMIN_EMAIL', 'admin@divinittys.cl'),
  ADMIN_PASSWORD: optionalEnv('ADMIN_PASSWORD'),
} as const;

// ── Warnings de credenciales de pago (no rompen el arranque) ─────
if (typeof process !== 'undefined' && isProduction) {
  const tbkEnv = env.TRANSBANK_ENV;
  if (tbkEnv === 'production') {
    if (!env.TRANSBANK_COMMERCE_CODE || env.TRANSBANK_COMMERCE_CODE === '597055555532') {
      console.error(
        '[env] WARN: TRANSBANK_COMMERCE_CODE parece ser de integración en modo production'
      );
    }
    if (!env.TRANSBANK_API_KEY) {
      console.error('[env] WARN: TRANSBANK_API_KEY vacío en producción');
    }
  }

  const mp = env.MERCADOPAGO_ACCESS_TOKEN;
  if (!mp) {
    console.warn('[env] WARN: MERCADOPAGO_ACCESS_TOKEN no configurado');
  } else if (!mp.startsWith('APP_USR') && !mp.startsWith('TEST-')) {
    console.warn('[env] WARN: MERCADOPAGO_ACCESS_TOKEN con formato inesperado');
  } else if (mp.startsWith('TEST-')) {
    console.warn(
      '[env] WARN: MERCADOPAGO_ACCESS_TOKEN es sandbox (TEST-). OK en prep; no usar en prod real.'
    );
  }

  if (!env.MERCADOPAGO_WEBHOOK_SECRET) {
    console.warn(
      '[env] WARN: MERCADOPAGO_WEBHOOK_SECRET vacío — webhooks sin validación de firma'
    );
  }
}
