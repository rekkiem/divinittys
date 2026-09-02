# Pre-migration checklist — DIVINITTYS → nuevo VPS Vultr (otra cuenta)

## Antes de tocar nada

- [ ] Confirmar que el VPS nuevo ya está creado (Ubuntu 22.04/24.04).
- [ ] Tener acceso SSH root/key al VPS nuevo.
- [ ] Tener método off-site listo (rclone B2 o rsync directo).
- [ ] Bajar TTL del DNS de `prep.divinittys.cl` / `divinittys.cl` a 300s si es posible.
- [ ] Anotar IP vieja e IP nueva.

## En el VPS actual (origen)

- [ ] Ejecutar `bash scripts/backup-stack-v2.sh` y verificar que generó:
  - postgres.sql.gz
  - env.production.backup
  - minio_data.tar.gz (+ resto de volúmenes)
  - app-code.tar.gz
  - openclaw.tar.gz  ← **crítico para el bot**
  - MANIFEST.txt + system-state.txt
- [ ] Revisar tamaño total (`du -sh backups/STAMP`) — esperado ~150-250 MB.
- [ ] Subir el directorio completo off-site (B2 o rsync al nuevo).
- [ ] Verificar integridad del backup.
- [ ] **No apagar** el VPS viejo todavía.

## En el VPS nuevo (destino)

- [ ] Bootstrap: `bash scripts/setup-vps.sh` o `setup-vultr-server.sh`.
- [ ] Clonar repo o restaurar `app-code.tar.gz`.
- [ ] Colocar `env.production.backup` → `.env.production` (chmod 600).
- [ ] Ajustar variables que dependan de IP/dominio (`AUTH_URL`, `NEXT_PUBLIC_APP_URL`, callbacks).
- [ ] Ejecutar `bash scripts/restore-stack-v2.sh /ruta/al/STAMP`.
- [ ] `docker compose -f docker-compose.prod.yml --env-file .env.production build app`
- [ ] `docker compose -f docker-compose.prod.yml --env-file .env.production up -d`
- [ ] Migraciones Prisma 6.2.1 (método seguro documentado).
- [ ] Reindex Meilisearch.
- [ ] Restaurar/arrancar OpenClaw y verificar identidad + Telegram.

## Validación antes de cambiar DNS

- [ ] `curl -sk https://NUEVA_IP/api/health` → `{"status":"ok"}`
- [ ] Contenedores healthy.
- [ ] Login admin funciona.
- [ ] Catálogo + imágenes cargan.
- [ ] Búsqueda responde.
- [ ] Preferencia MercadoPago se crea OK.
- [ ] OpenClaw responde con la misma personalidad/memoria.
- [ ] Certificado SSL válido o certbot listo.

## Cutover

- [ ] Cambiar registros A/AAAA al nuevo IP.
- [ ] Esperar propagación + probar desde fuera.
- [ ] Monitorear 24-48 h.
- [ ] Solo entonces destruir el VPS viejo.

## Post-cutover

- [ ] Actualizar webhooks externos (MercadoPago, etc.).
- [ ] Confirmar renovación automática de certs.
- [ ] Guardar este checklist + scripts en el repo.
