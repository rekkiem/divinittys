# Auditoría de competidores en Mercado Envíos Full

Mini-proyecto autónomo de **inteligencia de competencia** para Divinittys.

Detecta publicaciones de **terceros** en Mercado Libre Chile (`MLC`) que venden los mismos productos que nosotros y usan **Mercado Envíos Full** (`logistic_type: "fulfillment"`).

## Objetivo

- Extraer productos propios (Prisma / listado seller / demo).
- Consultar el buscador público de ML con identificadores universales (GTIN, SKU, marca+modelo, título).
- Filtrar resultados: Full + seller distinto de Divinittys (`55783347`).
- Generar reporte de alertas (JSON + CSV).

## Requisitos

- Node 20+ (o contenedor `node:20-alpine`).
- Token ML con scope de lectura:
  - Variable `ML_ACCESS_TOKEN`, **o**
  - Archivo `.oauth/ml-tokens.json` (mismo que `scripts/sync-ml-stock.ts`).
- Opcional: `DATABASE_URL` si se usa fuente Prisma.

## Uso

```bash
# Desde la raíz del repo
npx tsx scripts/ml-competitor-full-audit/index.ts --demo

# Con token explícito
ML_ACCESS_TOKEN=APP_USR-xxx npx tsx scripts/ml-competitor-full-audit/index.ts --source=seller

# Desde Prisma (productos activos con SKU ML-*)
DATABASE_URL=postgresql://... npx tsx scripts/ml-competitor-full-audit/index.ts --source=prisma

# Limitar cantidad y páginas
npx tsx scripts/ml-competitor-full-audit/index.ts --source=seller --limit=30 --max-pages=2
```

### Fuentes (`--source`)

| Valor     | Descripción |
|-----------|-------------|
| `demo`    | 1–2 productos de prueba (sin DB ni token obligatorio para dry structure). |
| `seller`  | Listado activo del seller `55783347` vía API (`/sites/MLC/search?seller_id=`). |
| `prisma`  | Productos activos en DB con `sku` que empieza por `ML-`. |

### Salida

Por defecto en `./artifacts/` (configurable con `ML_AUDIT_OUT`):

- `ml-full-competitors-YYYYMMDD.json`
- `ml-full-competitors-YYYYMMDD.csv`

## Estructura

```
scripts/ml-competitor-full-audit/
├── index.ts                 # CLI
├── config.ts
├── types.ts
├── sources/
│   ├── our-products.ts      # demo | seller | prisma
│   └── identifiers.ts       # queries de búsqueda
├── clients/
│   └── ml-api.ts            # search + item + token refresh
├── filters/
│   └── full-competitors.ts
└── report/
    └── generate.ts
```

## Criterio Full

```json
"shipping": {
  "logistic_type": "fulfillment",
  "mode": "me2"
}
```

Se excluye siempre el `seller_id` propio (`55783347`).

## Notas operativas (VPS / prod)

- Preferir token desde `.oauth/ml-tokens.json` montado en el contenedor (como en sync-ml-stock).
- Rate limit conservador: ~400 ms entre requests; reintentos en 429/5xx.
- Sin token válido la API de search suele responder **403**.
- No borrar volúmenes ni tocar compose de prod para correr este script.

## Próximos pasos posibles

- Score de similitud de título para reducir falsos positivos.
- Cron nocturno / job one-shot en compose.
- Webhook o notificación admin cuando aparezcan nuevos competidores Full.
