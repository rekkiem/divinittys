#!/usr/bin/env tsx

import crypto from 'crypto';
import fs from 'fs';

const clientId = process.env.ML_APP_ID;
const redirectUri = process.env.ML_REDIRECT_URI;

if (!clientId) {
  throw new Error('Missing ML_APP_ID');
}

if (!redirectUri) {
  throw new Error('Missing ML_REDIRECT_URI');
}

function base64url(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

const codeVerifier = base64url(crypto.randomBytes(32));

const codeChallenge = base64url(
  crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest()
);

const state = base64url(crypto.randomBytes(24));

fs.writeFileSync(
  '/app/.oauth/ml-oauth.json',
  JSON.stringify(
    {
      codeVerifier,
      state,
      redirectUri,
      createdAt: new Date().toISOString(),
    },
    null,
    2
  ),
  { mode: 0o600 }
);

const params = new URLSearchParams({
  response_type: 'code',
  client_id: clientId,
  redirect_uri: redirectUri,
  code_challenge: codeChallenge,
  code_challenge_method: 'S256',
  state,
});

const url =
  `https://auth.mercadolibre.cl/authorization?${params.toString()}`;

console.log('\n========================================');
console.log('MERCADO LIBRE OAUTH');
console.log('========================================\n');

console.log(url);

console.log('\nAbre esa URL en tu navegador.');
console.log('Autoriza la aplicación con la cuenta vendedora de Divinittys.');
console.log('\nDespués copia el parámetro "code" de la URL de retorno.\n');
