#!/usr/bin/env tsx

import fs from 'fs';

const appId = process.env.ML_APP_ID;
const clientSecret = process.env.ML_CLIENT_SECRET;
const redirectUri = process.env.ML_REDIRECT_URI;

if (!appId) throw new Error('Missing ML_APP_ID');
if (!clientSecret) throw new Error('Missing ML_CLIENT_SECRET');
if (!redirectUri) throw new Error('Missing ML_REDIRECT_URI');

const code = process.argv.find(arg => arg.startsWith('--code='))?.split('=').slice(1).join('=');

if (!code) {
  throw new Error(
    'Usage: npx tsx scripts/ml-oauth-exchange.ts --code=YOUR_CODE'
  );
}

const oauthFile = '/app/.oauth/ml-oauth.json';

if (!fs.existsSync(oauthFile)) {
  throw new Error(
    `${oauthFile} not found. Run ml-oauth-start.ts first in the same container.`
  );
}

const oauth = JSON.parse(fs.readFileSync(oauthFile, 'utf8'));

if (!oauth.codeVerifier) {
  throw new Error('codeVerifier missing from ml-oauth.json');
}

if (oauth.redirectUri !== redirectUri) {
  throw new Error(
    `Redirect URI mismatch:\n` +
    `OAuth file: ${oauth.redirectUri}\n` +
    `Environment: ${redirectUri}`
  );
}

console.log('\n========================================');
console.log('MERCADO LIBRE OAUTH TOKEN EXCHANGE');
console.log('========================================\n');

console.log('App ID:', appId);
console.log('Redirect URI:', redirectUri);
console.log('Code verifier:', oauth.codeVerifier ? 'PRESENT' : 'MISSING');

const body = new URLSearchParams({
  grant_type: 'authorization_code',
  client_id: appId,
  client_secret: clientSecret,
  code,
  redirect_uri: redirectUri,
  code_verifier: oauth.codeVerifier,
});

const response = await fetch('https://api.mercadolibre.com/oauth/token', {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body,
});

const text = await response.text();

console.log('\nHTTP:', response.status);

if (!response.ok) {
  console.error('\nOAuth exchange FAILED:');
  console.error(text);
  process.exit(1);
}

const data = JSON.parse(text);

console.log('\nOAuth exchange SUCCESSFUL.');

console.log('Token type:', data.token_type);
console.log('Expires in:', data.expires_in);
console.log('User ID:', data.user_id);

console.log(
  'Access token:',
  data.access_token
    ? `${data.access_token.slice(0, 12)}...`
    : 'MISSING'
);

console.log(
  'Refresh token:',
  data.refresh_token
    ? `${data.refresh_token.slice(0, 12)}...`
    : 'MISSING'
);

fs.writeFileSync(
  '/app/.oauth/ml-token.json',
  JSON.stringify(data, null, 2),
  { mode: 0o600 }
);

console.log('\nToken saved temporarily to:');
console.log('/tmp/ml-token.json');
