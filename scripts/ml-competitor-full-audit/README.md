# Auditoría de competidores en Mercado Envíos Full

Mini-proyecto autónomo de **inteligencia de competencia** para Divinittys.

Detecta publicaciones de **terceros** en Mercado Libre Chile (`MLC`) que venden los mismos productos que nosotros y usan **Mercado Envíos Full** (`logistic_type: "fulfillment"`).

## Hallazgo importante (API ML 2026)

| Endpoint | Con token seller Divinittys |
|----------|-----------------------------|
| `GET /users/me` | ✅ 200 |
| `GET /users/{id}/items/search` | ✅ 200 |
| `GET /items?ids=...` | ✅ 200 |
| `GET /sites/MLC/search` | ❌ 403 forbidden (PolicyAgent) |

Por eso este módulo:

1. **Carga productos propios** con la API **privada** del seller (`/users/.../items/search` + multiget).
2. **Busca competidores** intentando site search; si está bloqueado, usa **fallback** `products/search` por **GTIN** + detalle de catálogo/ítems y filtra Full.

## Requisitos

- Node 20+
- Token ML válido (scope `read` + offline):
  - `ML_ACCESS_TOKEN`, o
  - `.oauth/ml-tokens.json` (mismo que `sync-ml-stock`)

### Git Bash (Windows) — cargar token

```bash
export ML_ACCESS_TOKEN=$(python -c "import json; print(json.load(open('.oauth/ml-tokens.json'))['access_token'])")
echo "env_len=${#ML_ACCESS_TOKEN} env_prefix=${ML_ACCESS_TOKEN:0:15}"

curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $ML_ACCESS_TOKEN" \
  https://api.mercadolibre.com/users/me | head -c 200
```

Debe ser **HTTP 200**. Si el token expiró:

```bash
npx tsx scripts/ml-oauth-refresh.ts
# y volvé a exportar con python
```

## Uso

```bash
# Productos del seller ML (recomendado)
npx tsx scripts/ml-competitor-full-audit/index.ts --source=seller --limit=15 --max-pages=1

# Desde Prisma
DATABASE_URL=... npx tsx scripts/ml-competitor-full-audit/index.ts --source=prisma --limit=30

# Demo (estructura; sin matches reales esperables)
npx tsx scripts/ml-competitor-full-audit/index.ts --demo
```

Salida en `./artifacts/` (o `ML_AUDIT_OUT`):

- `ml-full-competitors-YYYYMMDD.json`
- `ml-full-competitors-YYYYMMDD.csv`

## Criterio Full

```json
"shipping": { "logistic_type": "fulfillment" }
```

Se excluye siempre `seller_id === 55783347`.

## Limitaciones

- Sin GTIN en el ítem, el fallback de catálogo encuentra menos competidores.
- Site search bloqueado implica menor cobertura por título libre.
- Rate limit ~400 ms entre requests.

## Estructura

```
scripts/ml-competitor-full-audit/
├── index.ts
├── config.ts
├── types.ts
├── clients/ml-api.ts
├── sources/our-products.ts
├── sources/identifiers.ts
├── filters/full-competitors.ts
└── report/generate.ts
```
