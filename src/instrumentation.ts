import { env } from '@/lib/env';
import { startEmailWorker } from '@/lib/queue/email.queue';
import { logger } from '@/lib/logger';

declare global {
  var __divinittysWorkersStarted: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (global.__divinittysWorkersStarted) return;

  global.__divinittysWorkersStarted = true;

  if (!env.REDIS_URL && !env.REDIS_HOST) {
    logger.warn('workers.skip', { reason: 'redis_missing' });
    return;
  }

  startEmailWorker();
  logger.info('workers.started', { email: true });
}
