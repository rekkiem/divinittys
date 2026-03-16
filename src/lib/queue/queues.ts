/**
 * BullMQ Queue definitions
 * Todas las colas reutilizan la misma conexión Redis
 */
import { Queue, Worker, QueueEvents } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// ── Queue names ──────────────────────────────────────────
export const QUEUE_NAMES = {
  EMAIL: 'divinittys:email',
  SEARCH_INDEX: 'divinittys:search',
  IMPORT: 'divinittys:import',
  NOTIFICATION: 'divinittys:notification',
} as const;

// ── Queue instances (lazy-init for edge compatibility) ───
let _emailQueue: Queue | null = null;
let _searchQueue: Queue | null = null;
let _importQueue: Queue | null = null;

export function getEmailQueue(): Queue {
  if (!_emailQueue) _emailQueue = new Queue(QUEUE_NAMES.EMAIL, { connection });
  return _emailQueue;
}

export function getSearchQueue(): Queue {
  if (!_searchQueue) _searchQueue = new Queue(QUEUE_NAMES.SEARCH_INDEX, { connection });
  return _searchQueue;
}

export function getImportQueue(): Queue {
  if (!_importQueue) _importQueue = new Queue(QUEUE_NAMES.IMPORT, { connection });
  return _importQueue;
}

// ── Job types ────────────────────────────────────────────
export type EmailJobData = {
  type: 'welcome' | 'order-confirmed' | 'shipping-update' | 'abandoned-cart' | 'promo';
  to: string;
  subject: string;
  templateData: Record<string, unknown>;
};

export type SearchIndexJobData = {
  action: 'index' | 'delete';
  productId: string;
};

export type ImportJobData = {
  userId: string;
  fichasBuffer: string; // base64
  preciosBuffer: string; // base64
};

// ── Helper: enqueue search index job ─────────────────────
export async function enqueueSearchIndex(productId: string, action: 'index' | 'delete' = 'index') {
  try {
    await getSearchQueue().add('search-index', { action, productId } satisfies SearchIndexJobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  } catch (e) {
    console.warn('[Queue] enqueueSearchIndex failed (Redis unavailable?):', e);
  }
}

// ── Helper: enqueue email ─────────────────────────────────
export async function enqueueEmail(data: EmailJobData) {
  try {
    await getEmailQueue().add('send-email', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 200,
      removeOnFail: 100,
    });
  } catch (e) {
    console.warn('[Queue] enqueueEmail failed:', e);
  }
}
