/**
 * Transbank Webpay Integration
 * Docs: https://www.transbankdevelopers.cl/documentacion/webpay-plus
 */

const TRANSBANK_BASE_URL =
  process.env.TRANSBANK_ENV === 'production'
    ? 'https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2'
    : 'https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2';

const COMMERCE_CODE = process.env.TRANSBANK_COMMERCE_CODE || '597055555532';
const API_KEY = process.env.TRANSBANK_API_KEY || '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';

const tbkHeaders = {
  'Tbk-Api-Key-Id': COMMERCE_CODE,
  'Tbk-Api-Key-Secret': API_KEY,
  'Content-Type': 'application/json',
};

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
  buyOrder: string;
  sessionId: string;
  cardDetail: { cardNumber: string };
  accountingDate: string;
  transactionDate: string;
  authorizationCode: string;
  paymentTypeCode: string;
  responseCode: number;
  installmentsNumber: number;
};

export async function createWebpayTransaction(
  params: WebpayCreateParams
): Promise<WebpayCreateResponse> {
  const res = await fetch(`${TRANSBANK_BASE_URL}/transactions`, {
    method: 'POST',
    headers: tbkHeaders,
    body: JSON.stringify({
      buy_order: params.buyOrder,
      session_id: params.sessionId,
      amount: Math.round(params.amount),
      return_url: params.returnUrl,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Webpay error: ${JSON.stringify(error)}`);
  }

  return res.json();
}

export async function commitWebpayTransaction(
  token: string
): Promise<WebpayCommitResponse> {
  const res = await fetch(`${TRANSBANK_BASE_URL}/transactions/${token}`, {
    method: 'PUT',
    headers: tbkHeaders,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Webpay commit error: ${JSON.stringify(error)}`);
  }

  return res.json();
}

export async function getWebpayTransaction(token: string) {
  const res = await fetch(`${TRANSBANK_BASE_URL}/transactions/${token}`, {
    method: 'GET',
    headers: tbkHeaders,
  });

  return res.json();
}

export async function refundWebpayTransaction(token: string, amount: number) {
  const res = await fetch(`${TRANSBANK_BASE_URL}/transactions/${token}/refunds`, {
    method: 'POST',
    headers: tbkHeaders,
    body: JSON.stringify({ amount }),
  });

  return res.json();
}

export function isWebpaySuccess(response: WebpayCommitResponse): boolean {
  return response.status === 'AUTHORIZED' && response.responseCode === 0;
}
