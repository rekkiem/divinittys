import { createQueue, createWorker } from './core';

export const seoQueue = createQueue('seo');

export function startSeoWorker() {
  return createWorker('seo', async () => {
    return;
  });
}
