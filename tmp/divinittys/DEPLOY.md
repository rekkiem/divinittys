# DIVINITTYS — Guía de Despliegue

## 🖥️ Local (Docker Desktop)

### Primera vez
```powershell
# 1. Clonar / extraer proyecto
cd C:\PRG\PROYECTOS\divinittys

# 2. El .env ya viene preconfigurado. 
#    Solo cambia puertos si hay conflictos:
#    PORT_APP=3001, PORT_POSTGRES=5433, etc.

# 3. Levantar todo
docker compose up --build

# 4. Esperar "🚀 Iniciando servidor..." (~2-3 min primera vez)
# App: http://localhost:3000
# Admin: http://localhost:3000/admin
# MinIO: http://localhost:9001
# Meilisearch: http://localhost:7700
```

### Reset completo
```powershell
docker compose down -v   # borra volúmenes (datos)
docker compose up --build
```

### Comandos útiles
```powershell
# Ver logs de un servicio
docker logs divinittys_app -f
docker logs divinittys_meili -f

# Ejecutar comandos en el contenedor
docker exec -it divinittys_app sh

# Health check manual
docker exec divinittys_app npx tsx scripts/health-check.ts
```

---

## ☁️ Render.com (Producción)

### Paso 1: Preparar repositorio
```bash
git init
git add .
git commit -m "feat: initial divinittys commit"
git remote add origin https://github.com/TU_USUARIO/divinittys.git
git push -u origin main
```

### Paso 2: Desplegar en Render
1. Ir a [render.com](https://render.com) → **New → Blueprint**
2. Conectar tu repositorio GitHub
3. Render detectará `render.yaml` y creará automáticamente:
   - Web Service (Next.js)
   - PostgreSQL (managed)
   - Redis (managed)

### Paso 3: Configurar variables secretas
En el dashboard de Render, configurar manualmente:
```
NEXT_PUBLIC_APP_URL = https://divinittys.onrender.com
OPENAI_API_KEY     = sk-...
MERCADOPAGO_ACCESS_TOKEN = ...
MEILISEARCH_URL    = https://tu-instancia.meilisearch.io
MEILISEARCH_API_KEY = ...
MINIO_ENDPOINT     = tu-bucket.r2.cloudflarestorage.com
MINIO_ACCESS_KEY   = ...
MINIO_SECRET_KEY   = ...
```

### Paso 4: Migrar base de datos
Render ejecuta automáticamente `prisma migrate deploy` en el startup.

### Costos estimados (Render)
| Servicio | Plan | Costo/mes |
|---|---|---|
| Web Service | Starter | $7 |
| PostgreSQL | Starter | $7 |
| Redis | Starter | $10 |
| **Total** | | **~$24/mes** |

---

## 🔍 Meilisearch en Producción

### Opción A: Meilisearch Cloud (Recomendado)
1. Crear cuenta en [cloud.meilisearch.com](https://cloud.meilisearch.com)
2. Crear proyecto → obtener URL y API Key
3. Configurar en Render:
   ```
   MEILISEARCH_URL = https://ms-xxx.meilisearch.io
   MEILISEARCH_API_KEY = tu_master_key
   ```

### Opción B: Self-hosted en Render
- Añadir servicio en render.yaml con imagen `getmeili/meilisearch:v1.6`

---

## 🧪 Tests

```bash
# Ejecutar suite completa
npm run test

# Solo smoke tests (requiere servicios corriendo)
npm run test:smoke

# Con cobertura
npm run test:coverage

# Health check manual
npm run health
```

---

## 📦 Variables de Entorno Requeridas

| Variable | Local | Producción | Descripción |
|---|---|---|---|
| `DATABASE_URL` | Auto (Docker) | Render DB | Conexión PostgreSQL |
| `REDIS_URL` | Auto (Docker) | Render Redis | Conexión Redis |
| `JWT_SECRET` | Incluido | Generar | Clave JWT (32+ chars) |
| `MEILISEARCH_URL` | `http://meilisearch:7700` | Cloud URL | Motor de búsqueda |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | URL pública | URL de la app |
| `OPENAI_API_KEY` | Opcional | Opcional | IA (mock sin clave) |
| `TRANSBANK_*` | Test incluidas | Cambiar en prod | Webpay |
