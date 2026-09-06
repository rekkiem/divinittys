/**
 * BullMQ core helpers
 * - Nombres SIN ":": BullMQ lanza "Queue name cannot contain :"
 * - createQueue diferido (Proxy): no hace `new Queue` hasta el primer uso,
 *   para no romper `next build` al importar payment-helpers → fulfillment.
 */
import { Queue, Worker, Job, type ConnectionOptions } from 'bullmq';

export type QueueJob = Job;

function getConnection(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && redisUrl.startsWith('redis://')) {
    try {
      const u = new URL(redisUrl);
      return {
        host: u.hostname || 'redis',
        port: u.port ? parseInt(u.port, 10) : 6379,
        password: u.password || undefined,
      };
    } catch {
      // fall through
    }
  }
  return {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  };
}

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

export function queueName(name: string): string {
  return `divinittys-${name.replace(/:/g, '-')}`;
}

const queueCache = new Map<string, Queue>();

function getOrCreateQueue(fullName: string): Queue {
  let q = queueCache.get(fullName);
  if (!q) {
    q = new Queue(fullName, {
      connection: getConnection(),
      defaultJobOptions,
    });
    queueCache.set(fullName, q);
  }
  return q;
}

/** Proxy: `new Queue` solo en el primer .add / método real */
export function createQueue(name: string): Queue {
  const fullName = queueName(name);
  return new Proxy({} as Queue, {
    get(_target, prop) {
      const real = getOrCreateQueue(fullName);
      const value = Reflect.get(real, prop, real);
      return typeof value === 'function' ? value.bind(real) : value;
    },
    set(_target, prop, value) {
      const real = getOrCreateQueue(fullName);
      return Reflect.set(real, prop, value, real);
    },
  });
}

export function createWorker(
  name: string,
  processor: (job: Job) => Promise<unknown>
): Worker {
  return new Worker(queueName(name), processor, {
    connection: getConnection(),
    concurrency: 5,
  });
}
