import { createQueue, createWorker } from './core';

export const importQueue = createQueue('import');

export function startImportWorker() {
  return createWorker('import', async () => {
    return;
  });
}
