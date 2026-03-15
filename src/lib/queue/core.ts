export type QueueJob = { name: string; data: Record<string, unknown> };

type Handler = (job: QueueJob) => Promise<void>;

const handlers = new Map<string, Handler>();

export function createQueue(name: string) {
  return {
    add: async (jobName: string, data: Record<string, unknown>) => {
      const handler = handlers.get(name);
      if (handler) await handler({ name: jobName, data });
    },
  };
}

export function createWorker(name: string, processor: Handler) {
  handlers.set(name, processor);
  return { close: async () => handlers.delete(name) };
}

export function createQueueEvents(_name: string) {
  return null;
}
