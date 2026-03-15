import { startEmailWorker } from '@/lib/queue/email.queue';
import { startSearchWorker } from '@/lib/queue/search.queue';
import { startSeoWorker } from '@/lib/queue/seo.queue';
import { startImportWorker } from '@/lib/queue/import.queue';
import { startNotificationWorker } from '@/lib/queue/notification.queue';

function bootstrap() {
  startEmailWorker();
  startSearchWorker();
  startSeoWorker();
  startImportWorker();
  startNotificationWorker();
  console.log('✅ Workers BullMQ iniciados');
}

bootstrap();
