# Migración entre proveedores (Vultr → otro VPS)

## Resumen en 6 pasos

1. **Backup** en el VPS actual  
2. **VPS nuevo** + `setup-vps.sh`  
3. **Código** (`git clone`)  
4. **Restore** datos + `.env`  
5. **DNS** al IP nuevo  
6. **Deploy** + reindex + webhooks

---

### 1) Backup en origen

```bash
cd /opt/divinittys
bash scripts/backup-stack.sh
# Copia el directorio backups/STAMP al VPS nuevo (scp/rsync)
rsync -avz backups/STAMP/ root@NUEVO_IP:/root/divinittys-backup/
```

### 2) Bootstrap destino

```bash
ssh root@NUEVO_IP
DOMAIN=divinittys.cl EMAIL=admin@divinittys.cl bash -c \
  'curl -fsSL https://raw.githubusercontent.com/rekkiem/divinittys/main/scripts/setup-vps.sh | bash'
# o clona el repo y ejecuta scripts/setup-vps.sh localmente
```

### 3) Código

```bash
git clone https://github.com/rekkiem/divinittys /opt/divinittys
cd /opt/divinittys
```

### 4) Restore

```bash
bash scripts/restore-stack.sh /root/divinittys-backup
# Ajusta NEXT_PUBLIC_APP_URL / DOMAIN si cambian
nano .env.production
```

### 5) DNS

Apunta `divinittys.cl`, `www`, `media` (y `prep` si aplica) al **IP nuevo**.  
Espera propagación y renueva certificados si hace falta.

### 6) Deploy

```bash
bash scripts/pre-deploy.sh --strict
bash scripts/deploy.sh --skip-pull
# Reindex búsqueda
docker compose -f docker-compose.prod.yml --env-file .env.production \
  --profile tools run --rm importer npx tsx scripts/reindex-search.ts
```

### Post-migración

- [ ] `curl -s https://divinittys.cl/api/health`
- [ ] Webhook MercadoPago → URL pública nueva
- [ ] Probar login admin y un producto con imagen
- [ ] OpenClaw: copiar `~/.openclaw` y unidad systemd si lo usas
- [ ] Apagar o destruir VPS viejo **solo** cuando el nuevo esté estable 48h

### Rollback

1. DNS otra vez al IP anterior  
2. El stack viejo sigue con sus volúmenes si no lo borraste  
