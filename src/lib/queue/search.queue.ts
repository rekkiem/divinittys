import { createQueue, createWorker, QueueJob } from './core';
import { deleteProductIndex, indexProduct } from '@/lib/search/meilisearch';

export const searchQueue = createQueue('search-index');

export async function enqueueProductIndex(productId: string) {
  await searchQueue.add('index-product', { productId });
}

export async function enqueueProductDelete(productId: string) {
  await searchQueue.add('delete-product', { productId });
}

export function startSearchWorker() {
  return createWorker('search-index', async (job: QueueJob) => {
    if (job.name === 'index-product') {
      await indexProduct(String(job.data.productId));
    }
    if (job.name === 'delete-product') {
      await deleteProductIndex(String(job.data.productId));
    }
  });
}
