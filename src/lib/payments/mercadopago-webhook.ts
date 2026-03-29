import crypto from 'crypto';
import { NextRequest } from 'next/server';

export function getMercadoPagoMode(accessToken?: string | null) {
  if (!accessToken) return 'disabled';
  return accessToken.startsWith('APP_USR-') ? 'production' : 'sandbox';
}

export function verifyMercadoPagoSignature(
  req: NextRequest,
  dataId: string,
  secret?: string | null
) {
  if (!secret) return false;

  const signatureHeader = req.headers.get('x-signature') || '';
  const requestId = req.headers.get('x-request-id') || '';
  if (!signatureHeader || !requestId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key?.trim(), value?.trim()];
    })
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const digest = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(v1));
  } catch {
    return false;
  }
}
