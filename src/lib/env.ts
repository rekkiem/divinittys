import 'server-only';
import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  TRANSBANK_ENV: z.enum(['integration', 'production']).default('integration'),
  TRANSBANK_COMMERCE_CODE: z.string().optional(),
  TRANSBANK_API_KEY: z.string().optional(),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_PUBLIC_KEY: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  BLUEXPRESS_API_KEY: z.string().optional(),
  BLUEXPRESS_ACCOUNT: z.string().optional(),
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.string().optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().optional(),
  MINIO_PUBLIC_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const env = parsed.data;

  if (!isTest && env.NEXT_PUBLIC_APP_URL.includes('localhost') && isProd) {
    throw new Error('NEXT_PUBLIC_APP_URL must be a public production URL');
  }

  if (!isTest && env.TRANSBANK_ENV === 'production') {
    if (!env.TRANSBANK_COMMERCE_CODE || !env.TRANSBANK_API_KEY) {
      throw new Error('Transbank production mode requires TRANSBANK_COMMERCE_CODE and TRANSBANK_API_KEY');
    }
  }

  if (!isTest && env.MERCADOPAGO_ACCESS_TOKEN && !env.MERCADOPAGO_PUBLIC_KEY) {
    throw new Error('MERCADOPAGO_PUBLIC_KEY is required when MercadoPago is enabled');
  }

  if (!isTest && env.SMTP_HOST && (!env.SMTP_USER || !env.SMTP_PASS || !env.EMAIL_FROM)) {
    throw new Error('SMTP_HOST requires SMTP_USER, SMTP_PASS and EMAIL_FROM');
  }

  cachedEnv = env;
  return env;
}

export function validateEnv() {
  return getEnv();
}

export const env = new Proxy({} as AppEnv, {
  get(_target, prop: keyof AppEnv) {
    return getEnv()[prop];
  },
});
