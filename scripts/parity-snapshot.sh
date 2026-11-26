#!/usr/bin/env bash
# ============================================================
# DIVINITTYS — parity-snapshot.sh
# Genera una "foto" normalizada del servidor. Se ejecuta en el VPS VIEJO
# y en el VPS NUEVO; luego se comparan con diff. SOLO LECTURA.
#
# Uso (en cada VPS):
#   cd /opt/divinittys && bash parity-snapshot.sh > /root/snap-$(hostname)-$(date +%Y%m%d-%H%M).txt
# Comparar (en tu PC o en el nuevo):
#   diff -u snap-viejo.txt snap-nuevo.txt | less
#
# No imprime valores de secretos: solo presencia y una huella de 8 hex
# (sha256 truncado) para poder comparar igualdad entre servidores.
# ============================================================
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/divinittys}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
cd "$APP_DIR" || { echo "No existe $APP_DIR"; exit 1; }

envget() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/\r$//; s/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//'; }
PGU=$(envget POSTGRES_USER); PGU=${PGU:-divinittys}
PGD=$(envget POSTGRES_DB);   PGD=${PGD:-divinittys}
RPW=$(envget REDIS_PASSWORD)
sec() { echo; echo "### $1"; }

sec "HOST (difiere por diseño: hostname, ip, fecha)"
echo "hostname=$(hostname)"; echo "date_utc=$(date -u +%FT%TZ)"
echo "os=$(. /etc/os-release && echo "$PRETTY_NAME")"; echo "kernel=$(uname -r)"
echo "timezone=$(timedatectl show -p Timezone --value 2>/dev/null)"
echo "ntp_synchronized=$(timedatectl show -p NTPSynchronized --value 2>/dev/null)"
echo "docker=$(docker --version)"; echo "compose=$(docker compose version --short 2>/dev/null)"

sec "CODIGO (commit desplegado y archivos modificados/sin versionar)"
if [ -d .git ]; then
  echo "git_head=$(git rev-parse HEAD)"; echo "git_branch=$(git rev-parse --abbrev-ref HEAD)"
  echo "-- git status (sin node_modules):"; git status --porcelain | grep -v node_modules | sort
else echo "sin repo .git en $APP_DIR (el código fue copiado, no clonado)"; fi
echo "-- sha256 de archivos de despliegue:"
sha256sum docker-compose.prod.yml docker/nginx/nginx.prod.conf Dockerfile docker/init.sql 2>/dev/null | awk '{print substr($1,1,12), $2}'

sec "CONTENEDORES (nombre imagen id-de-imagen; incluye los que NO son del compose)"
docker ps -a --format '{{.Names}} {{.Image}}' | sort | while read -r n i; do
  echo "$n $i $(docker inspect -f '{{.Image}}' "$n" 2>/dev/null | cut -c8-19) restarts=$(docker inspect -f '{{.RestartCount}}' "$n" 2>/dev/null) status=$(docker inspect -f '{{.State.Status}}' "$n" 2>/dev/null)"
done
sec "VOLUMENES"; docker volume ls -q | sort
sec "PUERTOS PUBLICADOS POR DOCKER"; docker ps --format '{{.Names}} {{.Ports}}' | sort
sec "PUERTOS EN ESCUCHA EN EL HOST"; ss -tlnH 2>/dev/null | awk '{print $4}' | sort -u

sec "ENV: nombres duplicados (deben ser ninguno)"
grep -E '^[A-Z_][A-Z0-9_]*=' "$ENV_FILE" | sed 's/\r$//' | cut -d= -f1 | sort | uniq -d
sec "ENV: nombres definidos"
grep -E '^[A-Z_][A-Z0-9_]*=' "$ENV_FILE" | cut -d= -f1 | sort -u | tr '\n' ' '; echo
sec "ENV: valores NO secretos"
for k in NODE_ENV DOMAIN NEXT_PUBLIC_APP_URL NEXT_PUBLIC_APP_NAME NEXTAUTH_URL AUTH_URL MINIO_PUBLIC_URL MINIO_BUCKET MINIO_ENDPOINT TRANSBANK_ENV SMTP_HOST SMTP_PORT SMTP_SECURE EMAIL_FROM ADMIN_EMAIL; do
  v=$(envget "$k"); [ -n "$v" ] && echo "$k=$v" || echo "$k=<vacío>"
done
sec "ENV: secretos (presente/vacío + huella 8 hex; igual huella = mismo valor)"
for k in POSTGRES_PASSWORD REDIS_PASSWORD MEILI_MASTER_KEY MINIO_ACCESS_KEY MINIO_SECRET_KEY JWT_SECRET JWT_REFRESH_SECRET AUTH_SECRET AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET TRANSBANK_COMMERCE_CODE TRANSBANK_API_KEY MERCADOPAGO_ACCESS_TOKEN MERCADOPAGO_WEBHOOK_SECRET OPENAI_API_KEY BLUEXPRESS_API_KEY SMTP_USER SMTP_PASS CRON_SECRET VENDOR_TELEGRAM_BOT_TOKEN VENDOR_TELEGRAM_CHAT_ID ADMIN_PASSWORD; do
  v=$(envget "$k")
  if [ -z "$v" ]; then echo "$k=<vacío>"; else echo "$k=presente len=${#v} fp=$(printf %s "$v" | sha256sum | cut -c1-8)"; fi
done
echo "env_file_perms=$(stat -c %a "$ENV_FILE" 2>/dev/null)"

sec "ARCHIVOS FUERA DE DOCKER QUE LA APP NECESITA (no viajan en los backups de volúmenes)"
for p in .oauth .oauth/ml-tokens.json .oauth/ml-oauth.json imports; do
  if [ -e "$p" ]; then echo "$p: $(stat -c '%A %U %s bytes mtime=%y' "$p" | cut -c1-70)"; else echo "$p: NO EXISTE"; fi
done
echo "-- contenido de $APP_DIR (nombre y tamaño, sin node_modules/.next/.git):"
find . -maxdepth 2 \( -name node_modules -o -name .next -o -name .git \) -prune -o -type f -printf '%P %s\n' 2>/dev/null | sort | grep -v -E '^(src|public|prisma|docs?|artifacts|log)/' | head -80

sec "TAREAS PROGRAMADAS DEL HOST (el cron de /api/cron/* vive aquí, no en el repo)"
echo "-- crontab root:"; crontab -l 2>/dev/null | grep -v '^#' | grep -v '^$' || echo "(vacío)"
echo "-- /etc/crontab:"; grep -v -E '^(#|$|SHELL|PATH|MAILTO)' /etc/crontab 2>/dev/null
echo "-- /etc/cron.d:"; for f in /etc/cron.d/*; do [ -f "$f" ] && { echo "[$f]"; grep -v -E '^(#|$|SHELL|PATH|MAILTO)' "$f"; }; done 2>/dev/null
echo "-- crontabs de otros usuarios:"; for u in $(cut -d: -f1 /etc/passwd); do crontab -l -u "$u" 2>/dev/null | grep -v -E '^(#|$)' | sed "s/^/[$u] /"; done
echo "-- systemd timers:"; systemctl list-timers --no-legend 2>/dev/null | awk '{print $NF, $(NF-1)}' | sort | grep -v -E 'apt|dpkg|logrotate|man-db|fstrim|motd|e2scrub|systemd-tmpfiles|update-notifier|ua-timer|snap|fwupd|sysstat|cloud'
echo "-- servicios activos relevantes:"; systemctl list-units --type=service --state=running --no-legend 2>/dev/null | awk '{print $1}' | grep -v -E '^(systemd|dbus|getty|serial|ssh|cron|rsyslog|snapd|multipathd|polkit|udisks|unattended|ModemManager|networkd|resolved|containerd|docker|cloud|qemu|irqbalance|accounts|packagekit|lvm|chrony|ntp)' | sort

sec "SEGURIDAD DEL HOST"
echo "ufw=$(ufw status 2>/dev/null | head -1)"; ufw status 2>/dev/null | grep -E 'ALLOW|DENY' | sort
echo "ssh_passwordauth=$(sshd -T 2>/dev/null | grep -i '^passwordauthentication')"; echo "ssh_permitroot=$(sshd -T 2>/dev/null | grep -i '^permitrootlogin')"
echo "fail2ban=$(systemctl is-active fail2ban 2>/dev/null)"; echo "reboot_required=$([ -f /var/run/reboot-required ] && echo SI || echo no)"
echo "overcommit_memory=$(sysctl -n vm.overcommit_memory 2>/dev/null)"
echo "docker_log_opts=$(docker info --format '{{.LoggingDriver}}' 2>/dev/null) $(cat /etc/docker/daemon.json 2>/dev/null | tr -d ' \n')"
echo "disk_root_use=$(df -h / | awk 'NR==2{print $5}')"
echo "otros_directorios_en_/home=$(ls /home 2>/dev/null | tr '\n' ' ')"
echo "procesos_openclaw=$(pgrep -fc -i openclaw 2>/dev/null)"

sec "POSTGRES — versión y parámetros"
dpsql() { docker exec -i divinittys_db psql -U "$PGU" -d "$PGD" -At "$@"; }
dpsql -c "select version();" 2>&1 | cut -c1-80
dpsql -c "show timezone;" -c "show server_encoding;" -c "show lc_collate;" 2>&1
sec "POSTGRES — migraciones Prisma"
dpsql -c "select count(*) filter (where finished_at is not null and rolled_back_at is null) as aplicadas, count(*) filter (where finished_at is null) as sin_terminar from _prisma_migrations;" 2>&1
dpsql -c "select migration_name from _prisma_migrations order by migration_name desc limit 3;" 2>&1
sec "POSTGRES — tabla|filas|md5-del-contenido (sessions y tablas volátiles pueden diferir)"
dpsql <<'SQL' 2>&1
select table_name || '|' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text || '|' ||
  (xpath('/row/m/text()', query_to_xml(format('select md5(coalesce(string_agg(t::text, '','' order by t::text), '''')) as m from public.%I t', table_name), false, true, '')))[1]::text
from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name;
SQL
sec "POSTGRES — constraints e índices"
dpsql -c "select 'fk='||count(*) from pg_constraint where contype='f';" -c "select 'pk='||count(*) from pg_constraint where contype='p';" -c "select 'unique='||count(*) from pg_constraint where contype='u';" -c "select 'indexes='||count(*) from pg_indexes where schemaname='public';" 2>&1
sec "POSTGRES — negocio"
dpsql -c "select 'productos activos/inactivos='||count(*) filter (where \"isActive\")||'/'||count(*) filter (where not \"isActive\") from products;" 2>&1
dpsql -c "select 'pedidos por estado: '||coalesce(string_agg(status||'='||n, ', '), '') from (select status::text, count(*) n from orders group by 1) s;" 2>&1
dpsql -c "select 'ultimo pedido='||coalesce(max(\"createdAt\")::text,'n/a') from orders;" -c "select 'ultimo usuario='||coalesce(max(\"createdAt\")::text,'n/a') from users;" 2>&1

sec "MINIO — objetos (sin metadata interna .minio.sys)"
vol=$(docker volume ls -q | grep -E 'minio_data$' | head -1)
docker run --rm -v "$vol":/d:ro alpine sh -c 'cd /d && echo "archivos=$(find . -type f -not -path "./.minio.sys/*" | wc -l)"; echo "bytes=$(du -sk --exclude=.minio.sys . | cut -f1)KB"; echo "md5_rutas_y_tamanos=$(find . -type f -not -path "./.minio.sys/*" -exec stat -c "%n %s" {} + | sort | md5sum | cut -c1-12)"; echo "buckets=$(ls -1 . | grep -v "^\.minio.sys$" | tr "\n" " ")"' 2>&1

sec "MEILISEARCH"
docker exec divinittys_meili sh -c 'curl -s -H "Authorization: Bearer $MEILI_MASTER_KEY" http://localhost:7700/stats' 2>&1 | sed -E 's/"fieldDistribution":\{[^}]*\}//g; s/"lastUpdate":"[^"]*",?//; s/"databaseSize":[0-9]+,?//'
echo
sec "REDIS (dbsize, AOF, política, colas BullMQ)"
r() { docker exec -e REDISCLI_AUTH="$RPW" divinittys_redis redis-cli "$@" 2>/dev/null; }
echo "ping=$(r ping)"; echo "dbsize=$(r dbsize)"; echo "appendonly=$(r config get appendonly | tail -1)"; echo "maxmemory_policy=$(r config get maxmemory-policy | tail -1)"
r --scan --pattern 'bull:*:*' | grep -E ':(wait|active|failed|delayed|paused|completed)$' | sort | while read -r k; do
  t=$(r type "$k"); case "$t" in list) n=$(r llen "$k");; zset) n=$(r zcard "$k");; *) n=$(r scard "$k");; esac; echo "$k=$n"
done
echo "carritos/sesiones_clave_muestra=$(r --scan --pattern '*' | sed -E 's/:[^:]*$//' | sort | uniq -c | sort -rn | head -8 | tr '\n' ';')"

sec "CERTIFICADOS"
docker run --rm -v divinittys_certbot_conf:/c:ro alpine sh -c 'ls /c/live 2>/dev/null; for f in /c/renewal/*.conf; do echo "[$f]"; grep -E "^(authenticator|webroot_path|account|server)" "$f"; grep -A3 "webroot_map" "$f"; done' 2>&1
docker run --rm -v divinittys_certbot_conf:/c:ro alpine sh -c 'apk add -q openssl >/dev/null 2>&1; for d in /c/live/*/; do n=$(basename $d); [ -f $d/cert.pem ] && echo "$n: $(openssl x509 -in $d/cert.pem -noout -enddate) $(openssl x509 -in $d/cert.pem -noout -ext subjectAltName 2>/dev/null | tail -1 | tr -d " ")"; done' 2>&1
echo
echo "### FIN SNAPSHOT"
