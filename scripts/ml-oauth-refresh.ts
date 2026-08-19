#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

const TOKEN_FILE = path.resolve(process.cwd(), '.oauth/ml-tokens.json');

async function main() {
  if (!fs.existsSync(TOKEN_FILE)) {
    throw new Error(`No existe ${TOKEN_FILE}`);
  }

  const current = JSON.parse(
    fs.readFileSync(TOKEN_FILE, 'utf8')
  );

  if (!current.refresh_token) {
    throw new Error('No existe refresh_token');
  }

  const clientId =
    process.env.ML_CLIENT_ID ||
    process.env.ML_APP_ID;

  const clientSecret =
    process.env.ML_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Faltan ML_CLIENT_ID/ML_APP_ID o ML_CLIENT_SECRET'
    );
  }

  console.log('🔄 Renovando token de Mercado Libre...');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: current.refresh_token,
  });

  const response = await fetch(
    'https://api.mercadolibre.com/oauth/token',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(
      '❌ Error renovando token:',
      JSON.stringify(data, null, 2)
    );
    process.exit(1);
  }

  const updated = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    user_id: data.user_id ?? current.user_id,
    scope: data.scope ?? current.scope,
    obtained_at: new Date().toISOString(),
  };

  fs.writeFileSync(
    TOKEN_FILE,
    JSON.stringify(updated, null, 2),
    { mode: 0o600 }
  );

  console.log('✅ Token renovado correctamente');
  console.log('USER ID:', updated.user_id);
  console.log('EXPIRES IN:', updated.expires_in, 'segundos');
  console.log('OBTAINED AT:', updated.obtained_at);
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
