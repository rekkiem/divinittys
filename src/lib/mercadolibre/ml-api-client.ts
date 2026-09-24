/**
 * Cliente HTTP reutilizable para la API de Mercado Libre.
 * Extraído y unificado desde scripts/ml-competitor-full-audit y sync-ml-stock.
 * Maneja token (.oauth o ML_ACCESS_TOKEN), refresh en 401 y backoff en 429/5xx.
 */
import fs from 'fs';

const DEFAULT_BASE = 'https://api.mercadolibre.com';
const DEFAULT_TOKEN_FILE =
  process.env.ML_TOKEN_FILE ||
  (fs.existsSync('/app/.oauth/ml-tokens.json')
    ? '/app/.oauth/ml-tokens.json'
    : '.oauth/ml-tokens.json');

export type TokenData = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id?: number;
  scope?: string;
  obtained_at?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MlApiClient {
  private token: string | undefined;
  private readonly baseUrl: string;
  private readonly tokenFile: string;
  private readonly maxRetries: number;
  private readonly requestDelayMs: number;

  constructor(opts?: {
    token?: string;
    baseUrl?: string;
    tokenFile?: string;
    maxRetries?: number;
    requestDelayMs?: number;
  }) {
    this.token = opts?.token || process.env.ML_ACCESS_TOKEN;
    this.baseUrl = opts?.baseUrl || DEFAULT_BASE;
    this.tokenFile = opts?.tokenFile || DEFAULT_TOKEN_FILE;
    this.maxRetries = opts?.maxRetries ?? 4;
    this.requestDelayMs = opts?.requestDelayMs ?? 250;
  }

  /** Carga token desde env o archivo .oauth (con refresh si expiró). */
  async ensureToken(): Promise<string | undefined> {
    if (this.token) return this.token;

    if (!fs.existsSync(this.tokenFile)) return undefined;

    const data: TokenData = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
    if (this.isExpired(data)) {
      this.token = await this.refreshFromFile(data);
    } else {
      this.token = data.access_token;
    }
    return this.token;
  }

  private isExpired(data: TokenData): boolean {
    if (!data.obtained_at) return true;
    return (
      Date.now() >=
      new Date(data.obtained_at).getTime() + data.expires_in * 1000 - 120_000
    );
  }

  private async refreshFromFile(data: TokenData): Promise<string> {
    const clientId = process.env.ML_CLIENT_ID;
    const clientSecret = process.env.ML_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.warn(
        '[MlApiClient] Token posiblemente expirado y faltan ML_CLIENT_ID/ML_CLIENT_SECRET; se usa el access_token actual.'
      );
      return data.access_token;
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: data.refresh_token,
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`OAuth refresh ${response.status}: ${text.slice(0, 300)}`);
    }
    const updated = JSON.parse(text);
    const newData: TokenData = {
      ...data,
      access_token: updated.access_token,
      refresh_token: updated.refresh_token || data.refresh_token,
      expires_in: updated.expires_in,
      obtained_at: new Date().toISOString(),
    };
    const tmp = `${this.tokenFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(newData, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.tokenFile);
    return newData.access_token;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'Divinittys-MlClient/1.0',
    };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  async getItem(itemId: string): Promise<any> {
    await this.ensureToken();
    return this.fetchWithRetry(`${this.baseUrl}/items/${itemId}`);
  }

  /** Descripción en plain_text (endpoint oficial /items/{id}/description). */
  async getDescription(itemId: string): Promise<{ plain_text: string; text?: string }> {
    await this.ensureToken();
    const data = await this.fetchWithRetry(
      `${this.baseUrl}/items/${itemId}/description`
    );
    return {
      plain_text: String(data?.plain_text ?? data?.text ?? ''),
      text: data?.text,
    };
  }

  /** Reviews agregados + paginación (Fase 2+). */
  async getReviews(
    itemId: string,
    opts: { offset?: number; limit?: number } = {}
  ): Promise<any> {
    await this.ensureToken();
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 5;
    const url = `${this.baseUrl}/reviews/item/${itemId}?offset=${offset}&limit=${limit}`;
    return this.fetchWithRetry(url);
  }

  /** Multiget de items (mismo patrón que sync-ml-stock). */
  async getItems(itemIds: string[]): Promise<any[]> {
    if (itemIds.length === 0) return [];
    await this.ensureToken();
    const url = `${this.baseUrl}/items?ids=${itemIds.join(',')}`;
    const result = await this.fetchWithRetry(url);
    if (!Array.isArray(result)) {
      throw new Error(`Respuesta inesperada de ML multiget: ${JSON.stringify(result).slice(0, 200)}`);
    }
    return result;
  }

  private async fetchWithRetry(url: string, attempt = 1): Promise<any> {
    let res = await fetch(url, { headers: this.headers() });

    if (res.status === 401 && this.token) {
      try {
        if (fs.existsSync(this.tokenFile)) {
          const data: TokenData = JSON.parse(
            fs.readFileSync(this.tokenFile, 'utf8')
          );
          this.token = await this.refreshFromFile(data);
          res = await fetch(url, { headers: this.headers() });
        }
      } catch {
        /* seguir con el error original */
      }
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt >= this.maxRetries) {
        throw new Error(`ML API ${res.status} after ${attempt} retries`);
      }
      await sleep(this.requestDelayMs * attempt * 2);
      return this.fetchWithRetry(url, attempt + 1);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ML API ${res.status}: ${body.slice(0, 250)}`);
    }

    await sleep(this.requestDelayMs);
    return res.json();
  }
}
