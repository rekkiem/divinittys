# Runbook operaciones

## Deploy diario / release

```bash
cd /opt/divinittys
bash scripts/pre-deploy.sh
bash scripts/deploy.sh
```

## Health

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
curl -s https://divinittys.cl/api/health
curl -s http://127.0.0.1/api/health
```

## Logs

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=100 app
docker compose -f docker-compose.prod.yml logs -f nginx
```

## Backup manual

```bash
bash scripts/backup-stack.sh
```

## Emergencia OOM

```bash
free -h
docker stats --no-stream
# Subir plan a ≥4GB o reducir Meili / limitar memoria en compose
```

## SSL

```bash
certbot renew
docker compose -f docker-compose.prod.yml restart nginx
```
