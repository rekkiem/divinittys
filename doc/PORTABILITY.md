# Portabilidad multi-proveedor

DIVINITTYS se despliega como **stack Docker Compose** autocontenido. No depende de APIs propietarias de Vultr (salvo el modelo de IA de OpenClaw, que es opcional y vive fuera de este compose).

## Principios

| Pieza | Portable | Notas |
|-------|----------|--------|
| App Next.js | ✅ | Imagen Docker multi-stage |
| Postgres / Redis / Meili / MinIO | ✅ | Volúmenes Docker |
| Nginx + TLS | ✅ | Certbot / Let's Encrypt |
| `.env.production` | ✅ | **No va a git**; se copia entre VPS |
| OpenClaw / Div_Bot | ⚠️ | Servicio aparte (systemd); migrar config `~/.openclaw` |
| DNS | Manual | Apuntar A/AAAA al IP nuevo |

## Qué NO atar al proveedor

- Paths hardcodeados solo por defecto (`/opt/divinittys`) — override con `APP_DIR`.
- Secrets solo en `.env.production` y backups cifrados/restringidos.
- Webhooks (MercadoPago, etc.) usan `NEXT_PUBLIC_APP_URL` → cambia al migrar dominio/IP.

## Scripts

```text
scripts/setup-vps.sh       # bootstrap Ubuntu (cualquier cloud)
scripts/pre-deploy.sh      # checklist antes de desplegar
scripts/deploy.sh          # build + up + migrate (portable)
scripts/deploy-vultr.sh    # alias → deploy.sh
scripts/backup-stack.sh    # dump DB + env + opcional MinIO
scripts/restore-stack.sh   # restore en VPS nuevo
```

## Variables de entorno de operación

```bash
export APP_DIR=/opt/divinittys
export ENV_FILE=.env.production
export COMPOSE_FILE=docker-compose.prod.yml
export PUBLIC_URL=https://divinittys.cl
export DOMAIN=divinittys.cl
export EMAIL=admin@divinittys.cl
```

## Requisitos mínimos del VPS destino

- Ubuntu 22.04+ (o Debian 12+)
- 2 vCPU / **4 GB RAM** (2 GB es insuficiente con Meili + Next)
- ≥ 40 GB disco
- Puertos 22, 80, 443
- Docker Engine + Compose plugin
