# DIVINITTYS — Deploy en Vultr (VPS + Docker Compose)

## Arquitectura en Vultr

```
Internet
    │
    ▼
Vultr VPS (Ubuntu 22.04, 2vCPU, 4GB RAM ~$24/mes)
    │
    ├── Nginx (80/443) ──────────── SSL + reverse proxy
    │       ├── divinittys.cl   → app:3000
    │       └── media.divinittys.cl → minio:9000
    │
    ├── Next.js app (puerto interno 3000)
    ├── PostgreSQL 16  (volumen persistente)
    ├── Redis 7        (volumen persistente)
    ├── Meilisearch 1.6 (volumen persistente)
    └── MinIO          (volumen persistente)
```

## Requisitos previos

- Cuenta Vultr: https://vultr.com
- Dominio `divinittys.cl` con DNS apuntando al VPS
- SSH key configurada en Vultr

## Paso 1 — Crear VPS en Vultr

En la UI de Vultr: **Deploy New Server**

| Campo | Valor |
|---|---|
| Type | Cloud Compute — Shared CPU |
| Location | Santiago (si disponible) o São Paulo |
| Image | Ubuntu 22.04 LTS |
| Plan | Regular — **2 vCPU, 4GB RAM** ($24/mes) |
| SSH Key | Agregar tu clave pública |
| Hostname | divinittys-prod |

> ⚠️ **2GB RAM** es insuficiente para Next.js + PostgreSQL + Meilisearch corriendo juntos.

## Paso 2 — Configurar DNS

En tu proveedor de dominio, crea estos registros **A**:

```
divinittys.cl       →  IP_DEL_VPS
www.divinittys.cl   →  IP_DEL_VPS
media.divinittys.cl →  IP_DEL_VPS
```

Espera 5-15 min a que propague antes de continuar.

## Paso 3 — Setup inicial del servidor (una sola vez)

```bash
# Conectar al VPS
ssh root@IP_DEL_VPS

# Ejecutar script de setup (instala Docker, UFW, Certbot, SSL)
curl -fsSL https://raw.githubusercontent.com/rekkiem/divinittys/main/scripts/setup-vultr-server.sh | bash
```

## Paso 4 — Subir el código al servidor

```bash
# Opción A: clonar desde GitHub (recomendado)
git clone https://github.com/rekkiem/divinittys /opt/divinittys

# Opción B: copiar desde tu máquina local (Windows)
scp -r . root@IP_DEL_VPS:/opt/divinittys
```

## Paso 5 — Configurar secrets

```bash
# En tu máquina local, generar secrets:
bash scripts/generate-secrets.sh

# Luego en el servidor:
cd /opt/divinittys
cp .env.example .env.production
nano .env.production   # reemplazar todos los __CHANGE_ME__
```

Variables obligatorias a reemplazar:

```bash
POSTGRES_PASSWORD=  # del script generate-secrets.sh
REDIS_PASSWORD=     # del script
MEILI_MASTER_KEY=   # del script
MINIO_SECRET_KEY=   # del script
JWT_SECRET=         # del script (128 chars hex)
JWT_REFRESH_SECRET= # del script (diferente al anterior)
```

## Paso 6 — Primer deploy

```bash
cd /opt/divinittys
bash scripts/deploy-vultr.sh --first-time
```

El flag `--first-time` ejecuta migraciones, seed de datos, setup de MinIO e indexación de Meilisearch.

## Paso 7 — Verificar

```bash
# Estado de todos los contenedores
docker compose -f docker-compose.prod.yml ps

# Health check
curl https://divinittys.cl/api/health
# Esperado: {"status":"healthy"} o {"status":"degraded"}

# Logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f app
```

## Redeploy (actualizaciones futuras)

```bash
# En el servidor, desde /opt/divinittys
bash scripts/deploy-vultr.sh
```

## Comandos útiles en producción

```bash
# Ver logs de un servicio específico
docker compose -f docker-compose.prod.yml logs -f postgres
docker compose -f docker-compose.prod.yml logs -f meilisearch

# Entrar al contenedor de la app
docker compose -f docker-compose.prod.yml exec app sh

# Correr migraciones manualmente
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# Backup de la base de datos
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U divinittys divinittys > backup_$(date +%Y%m%d).sql

# Restaurar backup
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U divinittys divinittys

# Fix emergencia (403, productos inactivos)
docker compose -f docker-compose.prod.yml exec app npx tsx scripts/fixDeploy.ts
```

## Troubleshooting

### App no inicia — OOM killed
```bash
free -h   # verificar RAM disponible
# Si < 500MB libre → upgrade a plan 4GB
```

### SSL no funciona
```bash
# Verificar DNS propaga
dig divinittys.cl +short

# Re-emitir certificado
certbot certonly --standalone -d divinittys.cl -d www.divinittys.cl -d media.divinittys.cl
docker compose -f docker-compose.prod.yml restart nginx
```

### Imágenes no cargan (403 admin)
```bash
docker compose -f docker-compose.prod.yml exec app npx tsx scripts/fixDeploy.ts
# Luego: cerrar sesión en navegador → limpiar localStorage → relogin
```

## Costo estimado Vultr

| Recurso | Plan | Costo/mes |
|---|---|---|
| VPS 2vCPU/4GB | Regular Cloud | ~$24 |
| Backups automáticos | 20% del VPS | ~$5 |
| Ancho de banda | 3TB incluido | $0 |
| **Total** | | **~$29/mes** |
