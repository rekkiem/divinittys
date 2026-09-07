/**
 * instrumentation.ts — intencionalmente mínimo.
 *
 * NO importar logger (node:fs), bullmq ni colas aquí: con instrumentationHook
 * webpack los mete en el build y rompe la imagen Docker.
 *
 * Workers BullMQ: servicio Docker `workers` (docker-compose.prod.yml).
 * Meilisearch index + abandoned orders: se pueden invocar desde workers o
 * endpoints admin; no dependen de este hook.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // no-op
}
