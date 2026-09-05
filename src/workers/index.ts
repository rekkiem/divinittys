import { startEmailWorker } from '@/lib/queue/email.queue';
import { startSearchWorker } from '@/lib/queue/search.queue';
import { startSeoWorker } from '@/lib/queue/seo.queue';
import { startImportWorker } from '@/lib/queue/import.queue';
import { startNotificationWorker } from '@/lib/queue/notification.queue';
import { startShippingWorker } from '@/lib/queue/shipping.queue';
import { startFulfillmentWorker } from '@/lib/queue/fulfillment.queue';

function bootstrap() {
  startEmailWorker();
  startSearchWorker();
  startSeoWorker();
  startImportWorker();
  startNotificationWorker();
  startShippingWorker();
  startFulfillmentWorker();
  console.log('✅ Workers BullMQ iniciados (email, search, seo, import, notification, shipping, fulfillment)');
}

bootstrap();
