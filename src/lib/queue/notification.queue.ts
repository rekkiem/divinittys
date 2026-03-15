import { createQueue, createWorker } from './core';

export const notificationQueue = createQueue('notification');

export function startNotificationWorker() {
  return createWorker('notification', async () => {
    return;
  });
}
