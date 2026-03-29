/**
 * MercadoPago Integration
 * Docs: https://www.mercadopago.cl/developers
 */

import { env } from '@/lib/env';

const MP_ACCESS_TOKEN = env.MERCADOPAGO_ACCESS_TOKEN || '';
const MP_BASE_URL = 'https://api.mercadopago.com';

const mpHeaders = {
  'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
  'X-Idempotency-Key': '',
};

export type MPPreferenceItem = {
  id: string;
  title: string;
  description?: string;
  picture_url?: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
};

export type MPPreferenceParams = {
  items: MPPreferenceItem[];
  payer?: {
    name?: string;
    email: string;
    phone?: { area_code: string; number: string };
  };
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  autoReturn?: 'approved' | 'all';
  externalReference: string;
  notificationUrl?: string;
  expires?: boolean;
  expirationDateFrom?: string;
  expirationDateTo?: string;
};

export type MPPreferenceResponse = {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  date_created: string;
};

export async function createMPPreference(
  params: MPPreferenceParams,
  idempotencyKey: string
): Promise<MPPreferenceResponse> {
  const headers = { ...mpHeaders, 'X-Idempotency-Key': idempotencyKey };

  const body = {
    items: params.items.map((item) => ({
      ...item,
      currency_id: item.currency_id || 'CLP',
    })),
    payer: params.payer,
    back_urls: params.backUrls,
    auto_return: params.autoReturn || 'approved',
    external_reference: params.externalReference,
    notification_url: params.notificationUrl,
    expires: params.expires,
    expiration_date_from: params.expirationDateFrom,
    expiration_date_to: params.expirationDateTo,
  };

  const res = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`MercadoPago error: ${JSON.stringify(error)}`);
  }

  return res.json();
}

export async function getMPPayment(paymentId: string) {
  const res = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  return res.json();
}

export async function getMPPreference(preferenceId: string) {
  const res = await fetch(`${MP_BASE_URL}/checkout/preferences/${preferenceId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  return res.json();
}

export function isSandbox(): boolean {
  return !MP_ACCESS_TOKEN.startsWith('APP_USR');
}
