# DIVINITTYS — E-Commerce de Productos de Belleza

> Plataforma e-commerce moderna para venta de productos de belleza profesional. Stack: Next.js 14, PostgreSQL, Prisma, Redis, Meilisearch, Docker.

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        DIVINITTYS Platform                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Next.js 14  │    │  PostgreSQL  │    │   Meilisearch    │  │
│  │  App Router  │───▶│    Prisma    │    │   Full-text      │  │
│  │  Port: 3000  │    │  Port: 5432  │    │   Port: 7700     │  │
│  └──────┬───────┘    └──────────────┘    └──────────────────┘  │
│         │                                                        │
│  ┌──────▼───────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  API Routes  │    │    Redis 7   │    │     MinIO S3     │  │
│  │  /api/*      │───▶│  Cache/Queue │    │  Object Storage  │  │
│  │  /api/admin/*│    │  Port: 6379  │    │  Port: 9000/9001 │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Flujo de autenticación:
  Browser → Cookie (httpOnly) + Authorization Bearer
         → verifyAccessToken (JWT)
         → prisma.user.findFirst (DB source of truth)
         → withAdmin() → 401/403/AdminUser
```

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | Next.js App Router | 14.2.x |
| Lenguaje | TypeScript | 5.5 |
| ORM | Prisma | 5.15 |
| Base de datos | PostgreSQL | 16 |
| Cache / Colas | Redis | 7 |
| Búsqueda | Meilisearch | 1.6 |
| Storage | MinIO (S3-compatible) | latest |
| Contenedores | Docker Compose | v3 |
| Tests | Vitest + Playwright | 2.1 / 1.45 |
| Pagos | Transbank Webpay + MercadoPago | SDK v6 |
| Envíos | Bluexpress API | REST |

---

## Requisitos

- **Docker Desktop** 4.x+ (con WSL2 en Windows)
- **Node.js** 20+ (solo para desarrollo local sin Docker)
- **npm** 10+
- 4GB RAM disponible para Docker

---

## Instalación y Despliegue Local

### 1. Clonar y configurar

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/divinittys.git
cd divinittys

# El .env viene preconfigurado para Docker local
# Solo necesitas editarlo si hay conflictos de puertos
cp .env.example .env
```

### 2. Levantar con Docker (recomendado)

```bash
docker compose up --build
```

Primera vez: ~3-5 minutos (descarga imágenes, instala deps, migra BD).

**URLs disponibles:**

| Servicio | URL | Credenciales |
|---|---|---|
| Tienda | http://localhost:3000 | — |
| Admin | http://localhost:3000/admin | admin@divinittys.cl / Admin123!@# |
| MinIO UI | http://localhost:9001 | divinittys_admin / divinittys_secret_2024 |
| Meilisearch | http://localhost:7700 | — |

### 3. Reset completo (limpia todos los datos)

```bash
docker compose down -v   # elimina volúmenes (DB, Redis, MinIO)
docker compose up --build
```

---

## Variables de Entorno

Copia `.env.example` a `.env` y ajusta según necesites:

```bash
# ── Puertos (cambia si hay conflictos) ──────────────
PORT_APP=3000
PORT_POSTGRES=5432
PORT_MINIO=9000
PORT_MINIO_CONSOLE=9001
PORT_MEILI=7700
# PORT_REDIS=6380  # Solo si tienes Redis local en 6379

# ── App ─────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# ── Base de datos ────────────────────────────────────
POSTGRES_USER=divinittys
POSTGRES_PASSWORD=divinittys_secret
POSTGRES_DB=divinittys
DATABASE_URL=postgresql://divinittys:divinittys_secret@postgres:5432/divinittys

# ── Redis ────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Meilisearch ──────────────────────────────────────
MEILI_MASTER_KEY=divinittys_meili_master_key_2024
MEILISEARCH_URL=http://meilisearch:7700
MEILISEARCH_API_KEY=divinittys_meili_master_key_2024

# ── Auth JWT ─────────────────────────────────────────
JWT_SECRET=divinittys_super_secret_jwt_key_local_dev_2024_abc
JWT_REFRESH_SECRET=divinittys_super_secret_refresh_key_local_dev_2024_xyz

# ── Pagos (integración para testing) ─────────────────
TRANSBANK_COMMERCE_CODE=597055555532
TRANSBANK_API_KEY=579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C
TRANSBANK_ENV=integration   # cambiar a "production" en producción

# ── APIs opcionales (mock/fallback sin ellas) ─────────
OPENAI_API_KEY=             # Para asistente LUNA
MERCADOPAGO_ACCESS_TOKEN=   # Para pagos con MercadoPago
BLUEXPRESS_API_KEY=         # Para cotizaciones de envío

# ── MinIO ────────────────────────────────────────────
MINIO_ROOT_USER=divinittys_admin
MINIO_ROOT_PASSWORD=divinittys_secret_2024
```

---

## Importación Masiva de Productos

### Desde MercadoLibre (formato xlsx oficial)

```bash
# 1. Exportar desde ML: Mis publicaciones → Exportar → xlsx

# 2. Dry run (sin cambios en DB, solo muestra qué importaría)
docker exec divinittys_app npx tsx scripts/import-ml-products.ts \
  --file=./Publicaciones.xlsx --dry-run

# 3. Importación real
docker exec divinittys_app npx tsx scripts/import-ml-products.ts \
  --file=./Publicaciones.xlsx

# 4. Solo una categoría
docker exec divinittys_app npx tsx scripts/import-ml-products.ts \
  --file=./Publicaciones.xlsx --category=coloracion

# 5. Re-indexar en Meilisearch después de importar
docker exec divinittys_app npx tsx scripts/reindex-search.ts
```

### Desde Excel personalizado (formato propio)

Usa el endpoint API directamente:

```bash
curl -X POST http://localhost:3000/api/import \
  -H "Authorization: Bearer <tu-token-admin>" \
  -F "fichas=@fichas_tecnicas.xlsx" \
  -F "precios=@precios_stock.xlsx"
```

**Formato esperado fichas técnicas:**
| sku | nombre | descripcion | categoria | marca | peso |
|---|---|---|---|---|---|

**Formato esperado precios/stock:**
| sku | precio | precio_comparar | stock | activo |
|---|---|---|---|---|

---

## Tests

```bash
# Ejecutar todos los tests (unit + integration + smoke)
npm run test

# Por tipo
npm run test:unit         # Funciones puras, utilidades
npm run test:integration  # Endpoints API con mocks
npm run test:smoke        # Conectividad (requiere servicios)
npm run test:coverage     # Con reporte HTML

# E2E con Playwright (requiere servidor corriendo)
npm run test:e2e          # Headless
npm run test:e2e:headed   # Con browser visible
npm run test:e2e:ui       # Con UI interactiva

# Health check de servicios
npm run health            # Desde host
docker exec divinittys_app npx tsx scripts/health-check.ts  # Desde Docker
```

**Cobertura actual (89 tests, 11 suites):**

| Suite | Tests | Estado |
|---|---|---|
| unit/admin-auth | 16 | ✅ |
| unit/admin | 8 | ✅ |
| unit/utils | 9 | ✅ |
| integration/admin-middleware | 11 | ✅ |
| integration/admin-products | 17 | ✅ |
| integration/admin-categories | 7 | ✅ |
| integration/admin-orders | 5 | ✅ |
| smoke/database | 6 | ✅ |
| smoke/meilisearch | 3 | ✅ |
| smoke/api-products | 4 | ✅ |
| smoke/auth | 3 | ✅ |

---

## Panel de Administración

### Acceso
1. Ir a `http://localhost:3000/cuenta/login`
2. Ingresar: `admin@divinittys.cl` / `Admin123!@#`
3. Serás redirigido a `/admin` automáticamente

### Módulos disponibles

| Módulo | Ruta | Funcionalidades |
|---|---|---|
| Dashboard | /admin | Estadísticas, pedidos recientes, stock bajo |
| Productos | /admin/productos | Listado, búsqueda, activar/desactivar, eliminar |
| Nuevo producto | /admin/productos/nuevo | Formulario completo con validación |
| Editar producto | /admin/productos/[slug]/editar | Pre-cargado con datos actuales |
| Pedidos | /admin/pedidos | Listado, cambio de estado |
| Clientes | /admin/clientes | Listado de usuarios registrados |
| Categorías | /admin/categorias | CRUD inline con edición en tabla |
| Stock | /admin/stock | Inventario completo con alertas |
| Ofertas | /admin/ofertas | Productos en oferta con % descuento |
| Importar | /admin/importar | Carga masiva desde Excel |

---

## CI/CD (GitHub Actions)

El archivo `.github/workflows/ci.yml` ejecuta:

```
push/PR → main ─┬─ unit-integration  (Vitest sin DB)
                ├─ typecheck         (tsc --noEmit)
                ├─ e2e               (Playwright + Docker, solo push)
                └─ docker-build      (verifica Dockerfile)
```

---

## Troubleshooting

### Error 403 al crear productos
```bash
# Opción A: Reset completo
docker compose down -v && docker compose up --build

# Opción B: Sin perder datos
curl -X POST http://localhost:3000/api/admin/fix-seed
# Luego cerrar sesión y volver a iniciar
```

### Diagnóstico 403
```bash
curl http://localhost:3000/api/admin/debug \
  -H "Cookie: access_token=<tu-token>"
# Muestra: rol en JWT, rol en DB, diagnóstico
```

### Puerto en uso (ERR_ADDR_IN_USE)
```bash
# Crear .env con puertos alternativos:
echo "PORT_APP=3001" >> .env
echo "PORT_POSTGRES=5433" >> .env
docker compose up --build
```

### Redis ENOTFOUND
```bash
# El health-check ejecutado desde el HOST usa localhost
# Para ejecutar dentro de Docker:
docker exec divinittys_app npx tsx scripts/health-check.ts
```

### Tests muestran "App not running"
```bash
# Normal: los smoke tests de API se saltan si el servidor no está corriendo
# Para ejecutarlos con servidor activo:
docker compose up -d
npm run test:smoke
```

### Meilisearch unhealthy
```bash
# Verificar que el healthcheck use la imagen correcta
docker logs divinittys_meili | head -20
# Debe mostrar "Package version: 1.6.x"
```

---

## Estructura del Proyecto

```
divinittys/
├── .github/workflows/ci.yml    # GitHub Actions CI/CD
├── docker-compose.yml           # Servicios: app, postgres, redis, meilisearch, minio
├── Dockerfile                   # Multi-stage: deps, development, builder, production
├── prisma/
│   ├── schema.prisma            # Modelos: User, Product, Category, Order, Inventory...
│   ├── seed.ts                  # Datos iniciales (admin, categorías, marcas)
│   └── migrations/              # Migraciones SQL
├── scripts/
│   ├── import-ml-products.ts    # Importador MercadoLibre xlsx
│   ├── import-products.ts       # Importador formato propio (fichas + precios)
│   ├── reindex-search.ts        # Re-indexación Meilisearch
│   └── health-check.ts          # Diagnóstico de servicios
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── admin/               # Panel administrativo
│   │   ├── api/                 # API Routes
│   │   │   ├── admin/           # Endpoints protegidos (withAdmin)
│   │   │   ├── auth/            # Login, registro, refresh
│   │   │   ├── products/        # Catálogo público
│   │   │   └── ...
│   │   ├── productos/           # Storefront catálogo
│   │   └── cuenta/              # Autenticación cliente
│   ├── components/
│   │   ├── admin/               # ProductForm, AdminSidebar, etc.
│   │   ├── shop/                # ProductCard, HeroSection, etc.
│   │   └── layout/              # Navbar, Footer, Providers
│   ├── lib/
│   │   ├── admin-auth.ts        # Middleware centralizado (withAdmin)
│   │   ├── auth.ts              # JWT, cookies, getAuthUser
│   │   ├── prisma.ts            # Cliente singleton
│   │   ├── search/meilisearch.ts # Cliente con fallback SQL
│   │   └── queue/               # BullMQ workers
│   ├── hooks/
│   │   ├── useAuth.ts           # Zustand + persist
│   │   └── useCart.ts           # Carrito con persistencia
│   └── tests/
│       ├── unit/                # Tests puros (sin I/O)
│       ├── integration/         # Tests API con mocks Prisma
│       ├── smoke/               # Tests conectividad
│       └── e2e/                 # Playwright flows
├── playwright.config.ts
├── vitest.config.ts
├── render.yaml                  # Deploy Render.com
└── DEPLOY.md                    # Guía de deploy en cloud
```

---

## Deploy en Producción (Render.com)

```bash
# 1. Subir a GitHub
git init && git add . && git commit -m "feat: initial"
git remote add origin https://github.com/usuario/divinittys.git
git push

# 2. En render.com: New → Blueprint → conectar repo
# Render detecta render.yaml y crea todos los servicios

# 3. Variables secretas a configurar en Render Dashboard:
#    NEXT_PUBLIC_APP_URL, JWT_SECRET, JWT_REFRESH_SECRET
#    OPENAI_API_KEY, MERCADOPAGO_ACCESS_TOKEN
#    MEILISEARCH_URL, MEILISEARCH_API_KEY
```

Costo estimado: ~$24/mes (web + PostgreSQL + Redis en plan Starter).

---

## Roadmap

### v2.0 — Marketplace (5 semanas)
- [ ] **Multi-vendor**: panel de vendedor, comisiones, payouts
- [ ] **Meilisearch avanzado**: autocompletado, facets, filtros dinámicos
- [ ] **BullMQ completo**: email automation, carrito abandonado
- [ ] **Marketing**: cupones, promociones programadas, newsletter
- [ ] **SEO masivo**: sitemap dinámico, JSON-LD, metadata dinámica

### v2.1 — Performance
- [ ] Cursor-based pagination (evita full scans con 1M+ productos)
- [ ] Redis caching en rutas críticas (TTL configurable)
- [ ] Next.js ISR en páginas de categoría y producto
- [ ] PgBouncer para connection pooling en producción

### v2.2 — Mobile
- [ ] PWA (Progressive Web App) con service workers
- [ ] Push notifications para estado de pedidos
- [ ] App Jetpack Compose (Android) — backend listo

---

## Licencia

MIT — Ver LICENSE para detalles.

---

**¿Problemas?** Abre un issue en GitHub o consulta la sección [Troubleshooting](#troubleshooting).
