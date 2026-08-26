/**
 * Configuración del mini-proyecto de auditoría Full.
 */

export const CONFIG = {
  siteId: 'MLC' as const,
  /** CustId / seller_id de Divinittys en ML Chile */
  ourSellerId: 55783347,
  baseUrl: 'https://api.mercadolibre.com',
  searchLimit: 50,
  maxPagesPerQuery: 3,
  /** Delay entre requests HTTP a la API ML */
  requestDelayMs: 400,
  maxRetries: 3,
  /** Ruta del archivo de tokens OAuth (mismo patrón que sync-ml-stock) */
  tokenFile:
    process.env.ML_TOKEN_FILE ||
    (process.env.NODE_ENV === 'production'
      ? '/app/.oauth/ml-tokens.json'
      : './.oauth/ml-tokens.json'),
  outputDir: process.env.ML_AUDIT_OUT || './artifacts',
};
