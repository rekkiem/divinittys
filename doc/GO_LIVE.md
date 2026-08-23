# Go-live producción (noche de lanzamiento)

Checklist operativa para dejar **divinittys.cl** en producción real.

> El stack ya corre en el **mismo VPS**. “Go-live” = DNS + secrets + URLs + tokens de pago + verificación.  
> **No** es migrar de servidor (eso es `doc/MIGRATION.md`).

---

## T-24h / antes de la noche

### A. DNS (crítico)

| Registro | Tipo | Valor |
|----------|------|--------|
| `divinittys.cl` | A | IP del VPS |
| `www.divinittys.cl` | A o CNAME | mismo IP / apex |
| `media.divinittys.cl` | A | mismo IP |
| `prep.divinittys.cl` | A | mismo IP (puede quedar para staging) |

Verificar:

```bash
dig +short divinittys.cl
curl -sI https://divinittys.cl | head -5
```

### B. SSL (Let’s Encrypt)

Nginx espera certificados en:

`/etc/letsencrypt/live/divinittys.cl/{fullchain,privkey}.pem`  
(montados vía volumen `certbot_conf`).

Si falla HTTPS:

```bash
docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d divinittys.cl -d www.divinittys.cl -d media.divinittys.cl \
  --email admin@divinittys.cl --agree-tos --non-interactive
docker compose -f docker-compose.prod.yml restart nginx
```

### C. Secrets en `.env.production` (no commitear)

| Variable | Prep OK | Producción |
|----------|---------|------------|
| `NEXT_PUBLIC_APP_URL` | puede ser prep | **`https://divinittys.cl`** |
| `NODE_ENV` | production | production |
| `MERCADOPAGO_ACCESS_TOKEN` | `TEST-...` | **`APP_USR-...`** solo cuando cobres real |
| `MERCADOPAGO_PUBLIC_KEY` | `TEST-...` | clave pública prod |
| `MERCADOPAGO_WEBHOOK_SECRET` | ideal | **obligatorio** |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | fijos | no rotar en go-live (cierra sesiones) |
| `CRON_SECRET` | recomendado | para cleanup pedidos |
| `GEMINI_API_KEY` | LUNA | mismo |
| `MINIO_PUBLIC_URL` | | `https://media.divinittys.cl` |
| Transbank | integration | **production** + códigos reales |

### D. MercadoPago panel (manual)

1. Webhook URL: `https://divinittys.cl/api/webhooks/mercadopago`  
2. Eventos: payments / merchant_order (según lo configurado)  
3. Copiar **secret** → `MERCADOPAGO_WEBHOOK_SECRET`  
4. No mezclar cuenta tester con comprador real (error `/fatal/`)

### E. Backup

```bash
cd /opt/divinittys
bash scripts/backup-stack.sh
```

---

## Noche de go-live (script)

```bash
cd /opt/divinittys
git pull origin main

# 1) Solo diagnóstico
bash scripts/go-live.sh --dry-run

# 2) Aplicar URLs prod + rebuild (sigue con tokens TEST- si no los cambiaste)
bash scripts/go-live.sh --apply

# 3) Cuando quieras cobros reales (tokens APP_USR- ya en .env):
bash scripts/go-live.sh --apply --with-mp-prod
```

El script:

1. Valida tokens / webhook secret / health  
2. Copia backup de `.env`  
3. Setea `NEXT_PUBLIC_APP_URL` + `NODE_ENV`  
4. Rebuild de `app`  
5. Reindex Meili (best-effort)  
6. Verifica `/api/health`

---

## Smoke test post go-live (15 min)

1. `https://divinittys.cl/api/health` → 200  
2. Home + búsqueda producto  
3. Login admin  
4. Imagen de producto (media)  
5. Checkout sandbox **o** pago real $ mínimo  
6. Webhook: logs app sin error de firma  
7. LUNA responde  

---

## Rollback rápido

```bash
cp backups/env.pre-golive.STAMP .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build app
# Opcional: DNS no hace falta si solo cambiaste env
```

---

## Notas Div_Bot (riesgos válidos)

1. **Secrets de pago** — copiar solo por canal seguro; nunca chat/git.  
2. **Certbot** — ligado al dominio; al **cambiar de VPS** hay que reemitir (mismo dominio = OK con DNS nuevo). En go-live **mismo VPS** no se pierden volúmenes.  
3. **Named volumes** — en go-live mismo servidor no se recrean; solo importan en **migración** (`backup-stack` / `restore-stack`).

---

## Orden recomendado mañana noche

```text
19:00  backup-stack + dry-run
19:30  DNS verificado + SSL OK
20:00  go-live --apply  (aún TEST- si quieres)
20:30  smoke test UI
21:00  poner APP_USR- + WEBHOOK_SECRET + --with-mp-prod
21:30  1 pago real mínimo + verificar pedido PAID
22:00  monitorear logs 30 min
```
