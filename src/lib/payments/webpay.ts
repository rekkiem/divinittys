/**
 * Transbank Webpay Plus Integration — SDK v6
 * Docs: https://www.transbankdevelopers.cl/documentacion/webpay-plus
 * SDK: https://github.com/TransbankDevelopers/transbank-sdk-nodejs
 */

import {
  WebpayPlus,
  Options,
  Environment,
  IntegrationCommerceCodes,
  IntegrationApiKeys,
} from 'transbank-sdk';
import { env } from '@/lib/env';

// ── Configuration ──────────────────────────────────────────────────────────

const isProduction = env.TRANSBANK_ENV === 'production';

function normalizeBuyOrder(buyOrder: string) {
  return buyOrder.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 26);
}

function getTransaction(): InstanceType<typeof WebpayPlus.Transaction> {
  if (isProduction) {
    // Production credentials from env
    const opts = new Options(
      env.TRANSBANK_COMMERCE_CODE!,
      env.TRANSBANK_API_KEY!,
      Environment.Production
    );
    return new WebpayPlus.Transaction(opts);
  }

  // Integration (test) — uses default integration keys
  const opts = new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    IntegrationApiKeys.WEBPAY,
    Environment.Integration
  );
  return new WebpayPlus.Transaction(opts);
}

// ── Types ──────────────────────────────────────────────────────────────────

export type WebpayCreateParams = {
  buyOrder: string;
  sessionId: string;
  amount: number;
  returnUrl: string;
};

export type WebpayCreateResponse = {
  token: string;
  url: string;
};

export type WebpayCommitResponse = {
  vci: string;
  amount: number;
  status: string;
  buy_order: string;
  session_id: string;
  card_detail: { card_number: string };
  accounting_date: string;
  transaction_date: string;
  authorization_code: string;
  payment_type_code: string;
  response_code: number;
  installments_number: number;
};

// ── API ────────────────────────────────────────────────────────────────────

export async function createWebpayTransaction(
  params: WebpayCreateParams
): Promise<WebpayCreateResponse> {
  const buyOrder = normalizeBuyOrder(params.buyOrder);
  if (!buyOrder || buyOrder.length > 26) {
    throw new Error('Invalid Webpay buyOrder');
  }

  const tx = getTransaction();
  const response = await tx.create(
    buyOrder,
    params.sessionId,
    params.amount,
    params.returnUrl
  );
  return { token: response.token, url: response.url };
}

export async function commitWebpayTransaction(
  token: string
): Promise<WebpayCommitResponse> {
  const tx = getTransaction();
  return tx.commit(token) as Promise<WebpayCommitResponse>;
}

export async function getWebpayTransactionStatus(
  token: string
): Promise<WebpayCommitResponse> {
  const tx = getTransaction();
  return tx.status(token) as Promise<WebpayCommitResponse>;
}

export async function refundWebpayTransaction(
  token: string,
  amount: number
): Promise<{ type: string; balance?: number }> {
  const tx = getTransaction();
  return tx.refund(token, amount) as Promise<{ type: string; balance?: number }>;
}

export { normalizeBuyOrder };
