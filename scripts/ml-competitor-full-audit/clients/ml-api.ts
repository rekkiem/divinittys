import fs from 'fs';
import { CONFIG } from '../config';
import type { TokenData } from '../types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MlApiClient {
  private token: string | undefined;

  constructor(token?: string) {
    this.token = token || process.env.ML_ACCESS_TOKEN;
  }

  /** Carga token desde env o archivo .oauth (con refresh si expiró). */
  async ensureToken(): Promise<string | undefined> {
    if (this.token) return this.token;

    const file = CONFIG.tokenFile;
    if (!fs.existsSync(file)) return undefined;

    const data: TokenData = JSON.parse(fs.readFileSync(file, 'utf8'));
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
        'Token OAuth posiblemente expirado y faltan ML_CLIENT_ID/ML_CLIENT_SECRET; se usa el access_token actual.'
      );
      return data.access_token;
    }

    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
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
    const tmp = `${CONFIG.tokenFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(newData, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, CONFIG.tokenFile);
    return newData.access_token;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'Divinittys-CompetitorFullAudit/1.0',
    };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  async search(q: string, offset = 0): Promise<any> {
    const url = new URL(`${CONFIG.baseUrl}/sites/${CONFIG.siteId}/search`);
    url.searchParams.set('q', q);
    url.searchParams.set('limit', String(CONFIG.searchLimit));
    url.searchParams.set('offset', String(offset));
    return this.fetchWithRetry(url.toString());
  }

  /** Publicaciones activas de un seller (fuente our-products). */
  async searchBySeller(sellerId: number, offset = 0): Promise<any> {
    const url = new URL(`${CONFIG.baseUrl}/sites/${CONFIG.siteId}/search`);
    url.searchParams.set('seller_id', String(sellerId));
    url.searchParams.set('limit', String(CONFIG.searchLimit));
    url.searchParams.set('offset', String(offset));
    return this.fetchWithRetry(url.toString());
  }

  async getItem(itemId: string): Promise<any> {
    return this.fetchWithRetry(`${CONFIG.baseUrl}/items/${itemId}`);
  }

  private async fetchWithRetry(url: string, attempt = 1): Promise<any> {
    let res = await fetch(url, { headers: this.headers() });

    if (res.status === 401 && this.token) {
      // Intentar refresh y una vez más
      try {
        if (fs.existsSync(CONFIG.tokenFile)) {
          const data: TokenData = JSON.parse(
            fs.readFileSync(CONFIG.tokenFile, 'utf8')
          );
          this.token = await this.refreshFromFile(data);
          res = await fetch(url, { headers: this.headers() });
        }
      } catch {
        /* seguir con el error original */
      }
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt >= CONFIG.maxRetries) {
        throw new Error(`ML API ${res.status} after ${attempt} retries`);
      }
      await sleep(CONFIG.requestDelayMs * attempt * 2);
      return this.fetchWithRetry(url, attempt + 1);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ML API ${res.status}: ${body.slice(0, 250)}`);
    }

    await sleep(CONFIG.requestDelayMs);
    return res.json();
  }
}
