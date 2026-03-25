/**
 * src/lib/queue/core.ts
 * BullMQ core helpers — queue and worker factory functions
 */
import { Queue, Worker, Job } from 'bullmq';

export type QueueJob = Job;

const connection = {
  host: process.env.REDIS_HOST || (process.env.REDIS_URL?.replace('redis://', '').split(':')[0] ?? 'redis'),
  port: parseInt(process.env.REDIS_PORT || process.env.REDIS_URL?.split(':').pop() || '6379'),
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

export function createQueue(name: string): Queue {
  return new Queue(`divinittys:${name}`, {
    connection,
    defaultJobOptions,
  });
}

export function createWorker(
  name: string,
  processor: (job: Job) => Promise<unknown>
): Worker {
  return new Worker(`divinittys:${name}`, processor, {
    connection,
    concurrency: 5,
  });
}
