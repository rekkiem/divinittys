import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TOKEN_FILE = '/app/.oauth/ml-tokens.json';
const BATCH_SIZE = 20;

type TokenData = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
  scope?: string;
  obtained_at?: string;
};

async function refreshToken(): Promise<string> {
  const data: TokenData = JSON.parse(
    fs.readFileSync(TOKEN_FILE, 'utf8')
  );

  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Faltan ML_CLIENT_ID o ML_CLIENT_SECRET');
  }

  console.log('🔄 Renovando OAuth...');

  const response = await fetch(
    'https://api.mercadolibre.com/oauth/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: data.refresh_token,
      }),
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `OAuth refresh ${response.status}: ${text}`
    );
  }

  const updated = JSON.parse(text);

  const newData: TokenData = {
    ...data,
    access_token: updated.access_token,
    refresh_token:
      updated.refresh_token || data.refresh_token,
    expires_in: updated.expires_in,
    obtained_at: new Date().toISOString(),
  };

  const tmp = `${TOKEN_FILE}.tmp`;

  fs.writeFileSync(
    tmp,
    JSON.stringify(newData, null, 2),
    { mode: 0o600 }
  );

  fs.renameSync(tmp, TOKEN_FILE);

  console.log('✅ OAuth renovado');

  return newData.access_token;
}

function tokenExpired(data: TokenData): boolean {
  if (!data.obtained_at) return true;

  const obtained = new Date(data.obtained_at).getTime();
  const expiresAt =
    obtained + (data.expires_in * 1000);

  // Renovar 2 minutos antes de expirar
  return Date.now() >= expiresAt - 120000;
}

async function getToken(): Promise<string> {
  const data: TokenData = JSON.parse(
    fs.readFileSync(TOKEN_FILE, 'utf8')
  );

  if (tokenExpired(data)) {
    return refreshToken();
  }

  return data.access_token;
}

async function fetchItems(
  itemIds: string[],
  token: string
): Promise<any[]> {
  const url =
    `https://api.mercadolibre.com/items?ids=${itemIds.join(',')}`;

  let response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Si expiró inesperadamente, renovar una vez.
  if (response.status === 401) {
    console.log('⚠️ Token rechazado. Renovando...');
    token = await refreshToken();

    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `ML ${response.status}: ${text}`
    );
  }

  const result = JSON.parse(text);

  if (!Array.isArray(result)) {
    throw new Error(
      `Respuesta inesperada de ML: ${text.slice(0, 500)}`
    );
  }

  return result;
}

async function main() {
  console.log('');
  console.log('══════════════════════════════════════');
  console.log(' DIVINITTYS — SYNC MERCADOLIBRE');
  console.log('══════════════════════════════════════');
  console.log(new Date().toISOString());

  let token = await getToken();

  const products = await prisma.product.findMany({
    where: {
      sku: {
        startsWith: 'ML-MLC',
      },
    },
    include: {
      inventory: true,
    },
    orderBy: {
      sku: 'asc',
    },
  });

  console.log(`Productos ML: ${products.length}`);

  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  for (
    let offset = 0;
    offset < products.length;
    offset += BATCH_SIZE
  ) {
    const batch = products.slice(
      offset,
      offset + BATCH_SIZE
    );

    const itemIds = batch.map(
      p => p.sku.replace(/^ML-/, '')
    );

    console.log(
      `\nConsultando ${offset + 1}-${Math.min(
        offset + BATCH_SIZE,
        products.length
      )}/${products.length}`
    );

    let items: any[];

    try {
      items = await fetchItems(itemIds, token);
    } catch (error: any) {
      console.error(
        `❌ Error lote: ${error.message}`
      );
      errors += batch.length;
      continue;
    }

    for (const result of items) {
      try {
        if (
          !result ||
          result.code !== 200 ||
          !result.body
        ) {
          console.error(
            `⚠️ ML sin datos: ${JSON.stringify(result).slice(0, 300)}`
          );
          errors++;
          continue;
        }

        const item = result.body;

        const sku = `ML-${item.id}`;

        const product = products.find(
          p => p.sku === sku
        );

        if (!product) {
          console.log(
            `⚠️ Producto no encontrado: ${sku}`
          );
          continue;
        }

        const stock =
          Number(item.available_quantity ?? 0);

        const isActive =
          item.status === 'active';

        const oldStock =
          product.inventory?.stock ?? 0;

        const oldActive =
          product.isActive;

        if (
          oldStock === stock &&
          oldActive === isActive
        ) {
          unchanged++;
          continue;
        }

        if (product.inventory) {
          await prisma.inventory.update({
            where: {
              productId: product.id,
            },
            data: {
              stock,
            },
          });
        } else {
          await prisma.inventory.create({
            data: {
              productId: product.id,
              stock,
              lowStockThreshold: 5,
              trackStock: true,
            },
          });
        }

        await prisma.product.update({
          where: {
            id: product.id,
          },
          data: {
            isActive,
          },
        });

        updated++;

        console.log(
          `🔄 ${sku} | ` +
          `stock ${oldStock} → ${stock} | ` +
          `active ${oldActive} → ${isActive}`
        );

      } catch (error: any) {
        errors++;

        console.error(
          `❌ Error procesando item: ${error.message}`
        );
      }
    }
  }

  console.log('');
  console.log('══════════════════════════════════════');
  console.log(' RESULTADO');
  console.log('══════════════════════════════════════');
  console.log(`Actualizados: ${updated}`);
  console.log(`Sin cambios:  ${unchanged}`);
  console.log(`Errores:      ${errors}`);
  console.log('');

  if (errors > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch(error => {
    console.error('');
    console.error('❌ ERROR FATAL:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
