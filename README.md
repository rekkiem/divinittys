# DIVINITTYS — E-Commerce de Productos de Belleza

> Plataforma e-commerce para venta de productos de belleza profesional. Stack: Next.js 14, PostgreSQL, Prisma 6.2.1, Redis, Meilisearch, Docker.
>
> Repo: https://github.com/rekkiem/divinittys · Producción: https://divinittys.cl · VPS: `/opt/divinittys` (`vps-div`).

---

## Estado (20 oct 2026)

Producción corre `main` con health `{"status":"ok"}`. El panel admin en móvil ya navega (drawer). El catálogo de prod **no** se regenera con el seed: vive en el volumen de Postgres.

| Ítem | Valor |
|---|---|
| Commit de referencia | `bc7f302` — drawer admin móvil (#19). Rollback previo: `41c6e4e` |
| Compose en el VPS | **siempre** `docker compose -f docker-compose.prod.yml --env-file .env.production` |
| Prisma | **6.2.1** (`npx prisma@6.2.1`). No usar `npx prisma` suelto (instala 7 y rompe el schema) |
| Admin | `admin@divinittys.cl` + `ADMIN_PASSWORD` del entorno (entrecomillar si lleva `#`) |

### Ya en producción

- Catálogo `catalogScope` BEAUTY | SECONDARY, SEO base, JSON-LD, robots / noindex de rutas privadas.
- Login propio (cookie `access_token`) y Google (Auth.js, basePath `/api/nextauth`). El layout de `/admin` sigue exigiendo la cookie JWT propia.
- Drawer admin <1024px: `AdminShell` + Radix Dialog, ítems en `src/components/admin/admin-nav.ts`. Sidebar fijo desde `lg`.
- Import ML, enrichment, direcciones de cliente, fulfillment post-pago (email / BX / Telegram).

### Deploy (VPS)

```bash
cd /opt/divinittys
git fetch origin && git checkout main && git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.production build app
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
curl -sk https://127.0.0.1/api/health
```

No borrar volúmenes (`postgres_data`, MinIO, Meili) salvo decisión explícita y backup. Este cambio de UI no requiere `migrate` ni seed. Un `curl` inmediato después del `up` puede dar 502 hasta que `divinittys_app` pase a healthy.

---

## Arquitectura del Sistema

```
┌───────────────────────────────────────────────────────────────────────┐
│                        DIVINITTYS Platform                      │
├───────────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  Next.js 14  │    │  PostgreSQL  │    │   Meilisearch    │  │
│  │  App Router  │───▶│    Prisma    │    │   Full-text      │  │
│  │  Port: 3000  │    │  Port: 5432  │    │   Port: 7700     │  │
│  └──────┬───────┘    └─────────────┘    └─────────────────┘  │
│         │                                                        │
│  ┌──────▼───────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  API Routes  │    │    Redis 7   │    │     MinIO S3     │  │
│  │  /api/*      │───▶│  Cache/Queue │    │  Object Storage  │  │
│  │  /api/admin/*│    │  Port: 6379  │    │  Port: 9000/9001 │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│                                                                  │
└───────────────────────────────────────────────────────────────────────────┘

Auth del panel:
  Browser → cookie httpOnly access_token (login email/password)
         → JWT verificado en el layout de /admin
  Google (Auth.js) no emite esa cookie por sí sola.
  Varios componentes admin también mandan Authorization Bearer desde Zustand.
```

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | Next.js App Router | 14.2.x |
| Lenguaje | TypeScript | 5.5 |
| ORM | Prisma | **6.2.1** |
| Base de datos | PostgreSQL | 16 |
| Cache / Colas | Redis | 7 |
| Búsqueda | Meilisearch | 1.6 |
| Storage | MinIO (S3-compatible) | latest |
| Contenedores | Docker Compose | prod: `docker-compose.prod.yml` |
| Tests | Vitest + Playwright | 2.1 / 1.45 |
| Pagos | Transbank Webpay + MercadoPago | Checkout Preferences |
| Envíos | Blue Express API | REST |

---

## Requisitos

- **Docker Desktop** 4.x+ (con WSL2 en Windows)
- **Node.js** 20+ para `npm run dev` en el host (en el VPS no depender del Node del sistema: usar la imagen `node:20-alpine`)
- **npm** 10+
- 4GB RAM disponible para Docker

---

## Instalación y Despliegue Local

### 1. Clonar y configurar

```bash
git clone https://github.com/rekkiem/divinittys.git
cd divinittys
cp .env.example .env
```

Si Next corre **en el host** (no dentro del contenedor `app`), ajustá `DATABASE_URL` y `REDIS_URL` como en [Local en el host](#local-en-el-host-windows-npm-run-dev).

### 2. Levantar con Docker (stack de desarrollo)

```bash
docker compose up --build
```

Primera vez: varios minutos (imágenes, deps, migración).

**URLs típicas (compose de desarrollo):**

| Servicio | URL |
|---|---|
| Tienda | http://localhost:3000 |
| MinIO UI | http://localhost:9001 |
| Meilisearch | http://localhost:7700 |

Credenciales: las de tu `.env` (`MINIO_*`, `MEILI_MASTER_KEY`). No commitear secretos reales.

### 3. Reset local (borra datos de desarrollo)

```bash
docker compose down -v
docker compose up --build
```

**No ejecutar `down -v` en el VPS.**

---

## Variables de Entorno

Copia `.env.example` a `.env` (local) o usá `.env.production` en el VPS. Placeholders, no secretos de producción:

```bash
PORT_APP=3000
PORT_POSTGRES=5432
PORT_MINIO=9000
PORT_MINIO_CONSOLE=9001
PORT_MEILI=7700

NEXT_PUBLIC_APP_URL=http://localhost:3000

POSTGRES_USER=divinittys
POSTGRES_PASSWORD=divinittys_secret
POSTGRES_DB=divinittys
# Dentro de Compose:
DATABASE_URL=postgresql://divinittys:divinittys_secret@postgres:5432/divinittys?schema=public
# Desde el host Windows, ver sección Estado (127.0.0.1:5433).

REDIS_URL=redis://redis:6379

MEILI_MASTER_KEY=change_me
MEILISEARCH_URL=http://meilisearch:7700
MEILISEARCH_API_KEY=change_me

JWT_SECRET=change_me_min_32_chars
JWT_REFRESH_SECRET=change_me_min_32_chars
AUTH_SECRET=change_me_min_32_chars

TRANSBANK_ENV=integration
MERCADOPAGO_ACCESS_TOKEN=
OPENAI_API_KEY=
BLUEXPRESS_API_KEY=

ADMIN_EMAIL=admin@divinittys.cl
ADMIN_PASSWORD="change_me"
```

Si `ADMIN_PASSWORD` contiene `#`, **tiene que ir entre comillas**. Dotenv trunca en `#`; Docker Compose no. El hash del seed depende de quién lo lea.

---

## Importación Masiva de Productos

El seed no importa el catálogo.

```bash
# Dry run
npx tsx scripts/import-ml-products.ts --file=./Publicaciones.xlsx --dry-run

# Importación real
npx tsx scripts/import-ml-products.ts --file=./Publicaciones.xlsx

# Reindex Meilisearch
npx tsx scripts/reindex-search.ts
```

Dentro del contenedor de prod, el mismo script vía `docker exec` sobre el servicio que tenga el repo y `DATABASE_URL` de la red Docker (`postgres`, no `127.0.0.1`).

Excel histórico en el repo: `Publicaciones-2026_03_22-21_10.xlsx`.

---

## Panel admin

| Módulo | Ruta |
|---|---|
| Dashboard | /admin |
| Productos | /admin/productos |
| Pedidos | /admin/pedidos |
| Clientes | /admin/clientes |
| Categorías | /admin/categorias |
| Stock | /admin/stock |
| Ofertas | /admin/ofertas |
| Importar | /admin/importar |
| Configuración | /admin/configuracion |

En viewport <1024px el menú es un drawer (hamburguesa). Desde `lg` el sidebar queda fijo. Archivos: `src/components/admin/AdminShell.tsx`, `AdminHeader.tsx`, `AdminSidebar.tsx`, `admin-nav.ts`.

---

## Tests

```bash
npm run test
npm run test:unit
npm run test:integration
npm run test:smoke
npm run test:e2e
npx tsc --noEmit
npm run lint
npm run build
```

E2E del drawer: `src/tests/e2e/admin-mobile-nav.e2e.ts` (viewport 390×844).

El aviso de build `Route /api/oauth/google-callback couldn't be rendered statically because it used headers` no aborta el build: la ruta es dinámica.

CI (`.github/workflows/ci.yml`): unit/integration, typecheck, e2e en push, docker build. Pendiente de merge: `npm ci --legacy-peer-deps` ([PR #12](https://github.com/rekkiem/divinittys/pull/12)), alineado con el Dockerfile.

---

## Troubleshooting

### No puedo entrar a /admin en local

1. `docker compose ps` — Postgres healthy y el puerto publicado coincide con `DATABASE_URL` (`5433` si `PORT_POSTGRES=5433`).
2. `npx prisma@6.2.1 migrate status` tiene que mostrar el mismo host/puerto que el `.env`. Si dice otro puerto, hay un `$env:DATABASE_URL` viejo en la sesión de PowerShell (`Remove-Item Env:DATABASE_URL`).
3. Redis: `docker exec … redis-cli ping` → `PONG`. Sin Redis, `POST /api/auth?action=login` puede colgarse (`ENOTFOUND redis` o `ECONNREFUSED 127.0.0.1:6379`).
4. Password del admin = valor completo de `ADMIN_PASSWORD` (con `#` si va entre comillas). Re-seed: `npx tsx prisma/seed.ts`.
5. Login Google no abre `/admin`: el layout lee la cookie `access_token`, que solo setea el login email/password.

### 502 justo después del deploy

Normal mientras `divinittys_app` está `health: starting`. Reintentar `curl` a los ~30 s. Si sigue, `docker compose … logs app --tail 80`.

### Prisma P1000 / P1001

P1000 = usuario/clave no coinciden con el volumen. P1001 = nadie escucha en ese host:puerto (contenedor caído, puerto mal, u otro Postgres).

### Puerto en uso

Cambiar `PORT_POSTGRES` (en Windows se usó **5433**) y la URL. No apuntar Prisma a un Postgres distinto del contenedor `divinittys_db`.

---

## Estructura del Proyecto

```
divinittys/
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile
├── prisma/                 # schema, seed, migrations
├── scripts/                # import-ml-products, reindex, reclassify, health
└── src/
    ├── app/admin/           # panel (layout servidor + AdminShell cliente)
    ├── app/api/
    ├── components/admin/    # AdminShell, admin-nav, sidebar, header
    ├── lib/
    └── tests/               # unit, integration, smoke, e2e
```

---

## Fases siguientes

### 1. Auth que no se caiga si Redis se cae

- Cliente Redis del **rate-limit** con timeout, `enableOfflineQueue: false` y fallback en memoria. No tocar el cliente BullMQ (`maxRetriesPerRequest: null`).
- Listener `error` para no inundar la consola.
- Bearer de Zustand inválido no debe anular una cookie `access_token` válida (la app Android futura sigue pudiendo usar Bearer).
- `/admin`: usuario activo y rol leídos de la BD, no solo la firma del JWT. BD caída = error claro, no 500 opaco.

### 2. DX local determinista

- `.env.example` coherente (host `127.0.0.1`, Postgres 5433, passwords entrecomilladas, Redis solo en loopback).
- Servicios opcionales (MinIO / Meili) sin bloquear el arranque de la app.
- Script PowerShell de arranque con reintento hasta que Postgres acepte TCP.
- Cerrar [PR #12](https://github.com/rekkiem/divinittys/pull/12) (CI `npm ci --legacy-peer-deps`).

### 3. Operación

- Backup diario (B2 u otro off-site) y prueba de restore.
- Rotar cualquier API key que haya quedado en logs o historial.
- Confirmar que el VPS viejo (`64.176.5.1`) esté apagado/destruido si la migración ya se observó.
- Pagos: `init_point` sandbox si el token MercadoPago empieza con `TEST-`; webhook POST HTTPS; prueba con credencial de producción y monto bajo.

### 4. SEO y tienda (opcional)

- URLs de categoría, logo en Organization JSON-LD, reindex en Search Console.
- Performance del storefront medida con `next build` / prod (no con `next dev`): `next/dynamic` en piezas no críticas y `LazyMotion`. El admin en prod ya tiene LCP ~0,9 s en móvil; no es el cuello.

### Más adelante

- PWA / push de pedidos.
- Paginación por cursor e ISR si el catálogo crece mucho.
- Multi-vendor completo (hay esqueleto de vendors; no es el foco operativo).

---

## Licencia

MIT — ver LICENSE.
