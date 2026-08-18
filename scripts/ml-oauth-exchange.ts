#!/usr/bin/env tsx
/**
 * Intercambia el code de ML por access_token + refresh_token (PKCE).
 * Uso:
 *   npx tsx scripts/ml-oauth-exchange.ts --code=TG-xxxxx
 */
import * as fs from 'fs';
import * as path from 'path';

const OAUTH_FILE = path.resolve(process.cwd(), '.oauth/ml-oauth.json');
const TOKEN_FILE = path.resolve(process.cwd(), '.oauth/ml-tokens.json');

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const code = getArg('code');
  if (!code) {
    console.error('Uso: npx tsx scripts/ml-oauth-exchange.ts --code=TG-xxxxx');
    process.exit(1);
  }

  if (!fs.existsSync(OAUTH_FILE)) {
    console.error('No existe .oauth/ml-oauth.json. Ejecuta primero ml-oauth-start.ts');
    process.exit(1);
  }

  const oauth = JSON.parse(fs.readFileSync(OAUTH_FILE, 'utf8')) as {
    codeVerifier: string;
    state: string;
    redirectUri: string;
  };

  const clientId = process.env.ML_CLIENT_ID || process.env.MERCADOLIBRE_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET || process.env.MERCADOLIBRE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Faltan ML_CLIENT_ID / ML_CLIENT_SECRET en el entorno');
    process.exit(1);
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: oauth.redirectUri,
    code_verifier: oauth.codeVerifier,
  });

  console.log('Intercambiando code por tokens...');
  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Error de ML:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const out = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    user_id: data.user_id,
    scope: data.scope,
    obtained_at: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(out, null, 2), { mode: 0o600 });
  console.log('Tokens guardados en', TOKEN_FILE);
  console.log('user_id:', out.user_id);
  console.log('expires_in:', out.expires_in, 'segundos');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
