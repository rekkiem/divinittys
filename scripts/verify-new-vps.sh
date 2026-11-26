#!/usr/bin/env bash
# ============================================================
# DIVINITTYS — verify-new-vps.sh
# Validación interna del VPS NUEVO. SOLO LECTURA (la única escritura es
# un pg_dump de prueba a /tmp dentro del contenedor, que se borra).
#
# Uso:  cd /opt/divinittys && bash verify-new-vps.sh
# Variables opcionales: EXPECT_PRODUCTS=228 EXPECT_ACTIVE=65 EXPECT_ORDERS=13 EXPECT_USERS=4
# Exit code = número de FAIL.
# ============================================================
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/divinittys}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DOMAIN="${DOMAIN:-divinittys.cl}"
EXPECT_PRODUCTS="${EXPECT_PRODUCTS:-228}"
EXPECT_ACTIVE="${EXPECT_ACTIVE:-65}"
EXPECT_ORDERS="${EXPECT_ORDERS:-13}"   # mínimo esperado (puede haber crecido)
EXPECT_USERS="${EXPECT_USERS:-4}"      # mínimo esperado
cd "$APP_DIR" || { echo "No existe $APP_DIR"; exit 99; }

P=0; F=0; W=0
pass() { echo "  [PASS] $1"; P=$((P+1)); }
fail() { echo "  [FAIL] $1"; F=$((F+1)); }
warn() { echo "  [WARN] $1"; W=$((W+1)); }
info() { echo "  [INFO] $1"; }
sect() { echo; echo "== $1"; }

envget() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/\r$//; s/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//'; }
PGU=$(envget POSTGRES_USER); PGU=${PGU:-divinittys}
PGD=$(envget POSTGRES_DB);   PGD=${PGD:-divinittys}
RPW=$(envget REDIS_PASSWORD)
dpsql() { docker exec -i divinittys_db psql -U "$PGU" -d "$PGD" -At "$@" 2>&1; }
LOCAL=(curl -sk -m 20 --resolve "$DOMAIN:443:127.0.0.1" --resolve "media.$DOMAIN:443:127.0.0.1" --resolve "www.$DOMAIN:443:127.0.0.1")

# ── S1 Contenedores ──────────────────────────────────────────
sect "S1 Contenedores"
for c in nginx certbot app workers postgres redis meilisearch minio; do
  n="divinittys_$c"; [ "$c" = "postgres" ] && n=divinittys_db; [ "$c" = "meilisearch" ] && n=divinittys_meili
  st=$(docker inspect -f '{{.State.Status}}' "$n" 2>/dev/null || echo ausente)
  hl=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}-{{end}}' "$n" 2>/dev/null)
  rc=$(docker inspect -f '{{.RestartCount}}' "$n" 2>/dev/null || echo 0)
  if [ "$st" != "running" ]; then fail "$n estado=$st"
  elif [ "$hl" != "-" ] && [ "$hl" != "healthy" ]; then fail "$n health=$hl"
  elif [ "${rc:-0}" -gt 2 ]; then warn "$n reinicios=$rc"
  else pass "$n running health=$hl reinicios=$rc"; fi
done
extra=$(docker ps -a --format '{{.Names}} {{.Status}}' | grep -v -E '^divinittys_(nginx|certbot|app|workers|db|redis|meili|minio) ' )
[ -z "$extra" ] && pass "sin contenedores huérfanos" || warn "contenedores adicionales/huérfanos (p.ej. runs de 'compose run' colgados): $(echo "$extra" | tr '\n' ';')"
grep -n -E 'image:.*:latest|image: [a-z/]+$' "$COMPOSE_FILE" | grep -v build >/dev/null && warn "imágenes sin tag fijo en $COMPOSE_FILE (minio:latest, certbot sin tag): migración futura no reproducible" || pass "tags de imagen fijos"
bad=$(docker ps --format '{{.Names}} {{.Ports}}' | grep -E '0\.0\.0\.0:(5432|6379|7700|9000|9001|3000)->' )
[ -z "$bad" ] && pass "solo 80/443 publicados al exterior" || fail "puertos internos expuestos: $bad"

# ── S2 Configuración ─────────────────────────────────────────
sect "S2 .env.production"
[ -f "$ENV_FILE" ] && pass "existe $ENV_FILE" || { fail "no existe $ENV_FILE"; }
[ "$(stat -c %a "$ENV_FILE" 2>/dev/null)" = "600" ] && pass "permisos 600" || warn "permisos $(stat -c %a "$ENV_FILE" 2>/dev/null) (recomendado 600)"
dups=$(grep -E '^[A-Z_][A-Z0-9_]*=' "$ENV_FILE" | cut -d= -f1 | sort | uniq -d | tr '\n' ' ')
[ -z "$dups" ] && pass "sin claves duplicadas" || fail "claves duplicadas: $dups (gana la última; riesgo de config incorrecta)"
chk() { v=$(envget "$1"); [ "$v" = "$2" ] && pass "$1=$2" || fail "$1='$v' (esperado '$2')"; }
chk NEXT_PUBLIC_APP_URL "https://$DOMAIN"
chk MINIO_PUBLIC_URL "https://media.$DOMAIN"
v=$(envget NEXTAUTH_URL); [ -z "$v" ] || [ "$v" = "https://$DOMAIN" ] && pass "NEXTAUTH_URL='$v'" || fail "NEXTAUTH_URL='$v'"
grep -E '^[A-Z_]+=.*(64\.176\.2[12]\.[0-9]+)' "$ENV_FILE" | cut -d= -f1 | grep -q . && fail "IP literal en: $(grep -E '^[A-Z_]+=.*(64\.176\.2[12]\.[0-9]+)' "$ENV_FILE" | cut -d= -f1 | tr '\n' ' ')" || pass "sin IPs literales en el env"
for k in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB REDIS_PASSWORD MEILI_MASTER_KEY MINIO_ACCESS_KEY MINIO_SECRET_KEY JWT_SECRET JWT_REFRESH_SECRET AUTH_SECRET; do
  [ -n "$(envget $k)" ] && pass "$k definido" || fail "$k vacío"
done
for k in AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET MERCADOPAGO_ACCESS_TOKEN MERCADOPAGO_WEBHOOK_SECRET TRANSBANK_COMMERCE_CODE TRANSBANK_API_KEY SMTP_HOST SMTP_USER SMTP_PASS EMAIL_FROM BLUEXPRESS_API_KEY CRON_SECRET VENDOR_TELEGRAM_BOT_TOKEN VENDOR_TELEGRAM_CHAT_ID; do
  [ -n "$(envget $k)" ] && pass "$k definido" || warn "$k vacío (¿intencional? funcionalidad asociada degradada)"
done
tbk=$(envget TRANSBANK_ENV); [ "$tbk" = "production" ] && pass "TRANSBANK_ENV=production" || warn "TRANSBANK_ENV='${tbk:-<vacío>}' (¡pagos Webpay en SANDBOX!). Confirmar con Rafa que es intencional"
[ "$(envget TRANSBANK_COMMERCE_CODE)" = "597055555532" ] && fail "TRANSBANK_COMMERCE_CODE es el de integración (597055555532)"
mp=$(envget MERCADOPAGO_ACCESS_TOKEN); case "$mp" in TEST-*) warn "MercadoPago en sandbox (TEST-)";; APP_USR*) pass "MercadoPago token de producción (APP_USR)";; "") ;; *) warn "formato inesperado de token MP";; esac
sect "S2b Secretos presentes en el historial de git (el repo es PÚBLICO)"
if [ -d .git ]; then
  for k in JWT_SECRET JWT_REFRESH_SECRET AUTH_SECRET POSTGRES_PASSWORD REDIS_PASSWORD MEILI_MASTER_KEY MINIO_ACCESS_KEY MINIO_SECRET_KEY MERCADOPAGO_ACCESS_TOKEN TRANSBANK_API_KEY SMTP_PASS BLUEXPRESS_API_KEY AUTH_GOOGLE_SECRET CRON_SECRET; do
    v=$(envget $k); [ ${#v} -lt 8 ] && continue
    if [ -n "$(git log --all --format=%h -S"$v" -- . 2>/dev/null | head -1)" ]; then fail "$k: el valor ACTUAL aparece en el historial de git → ROTAR"; else pass "$k no aparece en el historial"; fi
  done
  grep -F -q -f <(grep -E '^[A-Z_]+=.{8,}' .env.example 2>/dev/null | cut -d= -f2-) <(grep -E '^(POSTGRES_PASSWORD|MINIO_SECRET_KEY|JWT_SECRET|MEILI_MASTER_KEY)=' "$ENV_FILE" | cut -d= -f2-) && fail "algún secreto coincide con valores de .env.example (defaults públicos)" || pass "ningún secreto crítico usa defaults de .env.example"
else warn "sin .git en $APP_DIR: no se puede comprobar el historial (hacerlo en un clon: git log --all -S'<valor>')"; fi

# ── S3 Archivos fuera de Docker ──────────────────────────────
sect "S3 Archivos que no viajan en los volúmenes"
if [ -s .oauth/ml-tokens.json ]; then pass ".oauth/ml-tokens.json presente ($(stat -c '%s bytes, mtime %y' .oauth/ml-tokens.json | cut -c1-45))"
else fail ".oauth/ml-tokens.json AUSENTE: la integración Mercado Libre (sync stock/precios) no funcionará"; fi
grep -n '\.oauth' "$COMPOSE_FILE" | grep -q ':ro' && warn "compose monta ./.oauth en SOLO LECTURA: el refresh automático de tokens no podrá persistir el token nuevo"
[ -d imports ] && pass "./imports existe" || warn "./imports no existe (solo necesario para importaciones manuales)"
crontab -l 2>/dev/null | grep -q 'api/cron' && pass "cron de /api/cron/* instalado en este host" || fail "NO hay crontab que invoque /api/cron/cleanup-abandoned-orders (en el viejo debía existir; sin él los pedidos abandonados nunca se cancelan ni liberan stock)"
[ -n "$(crontab -l 2>/dev/null | grep -i backup)" ] && pass "cron de backup presente" || fail "sin backup automático programado"

# ── S4 PostgreSQL ────────────────────────────────────────────
sect "S4 PostgreSQL"
[ "$(dpsql -c 'select 1;')" = "1" ] && pass "conexión OK" || fail "no conecta: $(dpsql -c 'select 1;' | head -1)"
nt=$(dpsql -c "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"); [ "${nt:-0}" -ge 20 ] 2>/dev/null && pass "tablas públicas: $nt" || fail "tablas públicas: $nt"
np=$(dpsql -c 'select count(*) from products;');        [ "$np" = "$EXPECT_PRODUCTS" ] && pass "products=$np" || fail "products=$np (esperado $EXPECT_PRODUCTS)"
na=$(dpsql -c 'select count(*) from products where "isActive";'); [ "$na" = "$EXPECT_ACTIVE" ] && pass "productos activos=$na" || fail "productos activos=$na (esperado $EXPECT_ACTIVE)"
no=$(dpsql -c 'select count(*) from orders;');          [ "${no:-0}" -ge "$EXPECT_ORDERS" ] 2>/dev/null && pass "orders=$no (>= $EXPECT_ORDERS)" || fail "orders=$no (esperado >= $EXPECT_ORDERS)"
nu=$(dpsql -c 'select count(*) from users;');           [ "${nu:-0}" -ge "$EXPECT_USERS" ] 2>/dev/null && pass "users=$nu (>= $EXPECT_USERS)" || fail "users=$nu (esperado >= $EXPECT_USERS)"
nfk=$(dpsql -c "select count(*) from pg_constraint where contype='f';"); [ "${nfk:-0}" -gt 0 ] 2>/dev/null && pass "foreign keys restauradas: $nfk" || fail "sin foreign keys (restore incompleto)"
mig=$(dpsql -c "select count(*) from _prisma_migrations where finished_at is null or rolled_back_at is not null;"); [ "$mig" = "0" ] && pass "migraciones Prisma completas" || fail "migraciones sin terminar/revertidas: $mig"
orph=$(dpsql -c 'select count(*) from product_images i left join products p on p.id = i."productId" where p.id is null;'); case "$orph" in 0) pass "product_images sin huérfanas";; *) warn "chequeo de huérfanas: $orph";; esac
last=$(dpsql -c 'select coalesce(max("createdAt")::text,$$n/a$$) from orders;'); info "último pedido: $last"
sect "S4b Backups (BLOQUEANTE para decomisionar)"
docker exec divinittys_db rm -f /tmp/verify.dump >/dev/null 2>&1
if docker exec divinittys_db pg_dump -U "$PGU" -d "$PGD" -Fc --no-owner -f /tmp/verify.dump >/tmp/pgdump.err 2>&1 && [ "$(docker exec divinittys_db stat -c %s /tmp/verify.dump 2>/dev/null || echo 0)" -gt 50000 ]; then
  pass "pg_dump funciona ($(docker exec divinittys_db stat -c %s /tmp/verify.dump) bytes)"
else fail "pg_dump FALLA: $(head -c 200 /tmp/pgdump.err | tr '\n' ' ') — sin backup lógico no se puede decomisionar el VPS viejo"; fi
docker exec divinittys_db rm -f /tmp/verify.dump >/dev/null 2>&1
newest=$(find /root/backups /opt/divinittys/backups -type f \( -name '*.dump' -o -name '*.sql.gz' \) -size +50k -mmin -1560 2>/dev/null | head -1)
[ -n "$newest" ] && pass "existe un backup válido de <26h: $newest" || fail "no hay backup (>50 KB) de las últimas 26 h"
find /root/backups /opt/divinittys/backups -type f -size 0 2>/dev/null | grep -q . && fail "hay backups de 0 bytes: $(find /root/backups /opt/divinittys/backups -type f -size 0 2>/dev/null | head -3 | tr '\n' ' ')"
ls /root/*.dump >/dev/null 2>&1 && info "dumps manuales en /root: $(ls -1 /root/*.dump | tr '\n' ' ')"

# ── S5 Redis ─────────────────────────────────────────────────
sect "S5 Redis"
r() { docker exec -e REDISCLI_AUTH="$RPW" divinittys_redis redis-cli "$@" 2>/dev/null; }
[ "$(r ping)" = "PONG" ] && pass "PONG con password" || fail "Redis no responde con REDIS_PASSWORD"
info "dbsize=$(r dbsize)"
[ "$(r config get appendonly | tail -1)" = "yes" ] && pass "AOF activo" || fail "AOF desactivado"
[ "$(r config get maxmemory-policy | tail -1)" = "noeviction" ] && pass "maxmemory-policy=noeviction (requerido por BullMQ)" || fail "maxmemory-policy incorrecta"
[ "$(sysctl -n vm.overcommit_memory 2>/dev/null)" = "1" ] && pass "vm.overcommit_memory=1" || warn "vm.overcommit_memory!=1 (riesgo de fallo de guardado Redis)"
failed=0; for k in $(r --scan --pattern 'bull:*:failed'); do n=$(r zcard "$k"); failed=$((failed+${n:-0})); done
[ "$failed" -eq 0 ] && pass "colas BullMQ sin trabajos fallidos" || warn "trabajos fallidos en BullMQ: $failed (inspeccionar: ¿correos/envíos sin procesar tras la migración?)"
wait_=0; for k in $(r --scan --pattern 'bull:*:wait'); do n=$(r llen "$k"); wait_=$((wait_+${n:-0})); done
[ "$wait_" -lt 20 ] && pass "cola en espera: $wait_" || warn "cola en espera acumulada: $wait_ (¿worker caído?)"

# ── S6 Meilisearch ───────────────────────────────────────────
sect "S6 Meilisearch"
docs=$(docker exec divinittys_meili sh -c 'curl -s -H "Authorization: Bearer $MEILI_MASTER_KEY" http://localhost:7700/indexes/products/stats' | grep -o '"numberOfDocuments":[0-9]*' | cut -d: -f2)
[ "$docs" = "$na" ] && pass "índice products=$docs coincide con productos activos en BD" || fail "índice products=${docs:-?} vs activos en BD=$na → reindexar: docker compose --profile tools run --rm importer npx tsx scripts/reindex-search.ts"
hits=$(docker exec divinittys_meili sh -c 'curl -s -H "Authorization: Bearer $MEILI_MASTER_KEY" -H "Content-Type: application/json" -d "{\"q\":\"shampoo\",\"limit\":1}" http://localhost:7700/indexes/products/search' | grep -o '"estimatedTotalHits":[0-9]*' | cut -d: -f2)
[ "${hits:-0}" -gt 0 ] && pass "búsqueda 'shampoo' devuelve $hits resultados" || fail "búsqueda 'shampoo' sin resultados"

# ── S7 MinIO / imágenes ──────────────────────────────────────
sect "S7 MinIO e imágenes (HEAD a TODAS las URLs de product_images)"
dpsql -c "select distinct url from product_images where url like 'https://media.$DOMAIN/%';" > /tmp/urls.txt
tot=$(wc -l < /tmp/urls.txt); info "URLs distintas en media.$DOMAIN: $tot"
xargs -P 8 -I{} sh -c 'c=$(curl -sk -m 15 -o /dev/null -w "%{http_code}" --resolve media.'"$DOMAIN"':443:127.0.0.1 -I "{}"); echo "$c {}"' < /tmp/urls.txt > /tmp/urls.res
bad=$(grep -v -c '^200 ' /tmp/urls.res)
[ "$bad" = "0" ] && pass "todas las imágenes ($tot) responden 200" || { fail "$bad imágenes no responden 200"; grep -v '^200 ' /tmp/urls.res | head -5; }
rm -f /tmp/urls.txt /tmp/urls.res
[ "$(docker exec divinittys_minio curl -s -o /dev/null -w '%{http_code}' http://localhost:9000/minio/health/live)" = "200" ] && pass "MinIO live" || fail "MinIO no live"

# ── S8 nginx, TLS, cron y certbot ────────────────────────────
sect "S8 nginx y certificados"
docker exec divinittys_nginx nginx -t >/dev/null 2>&1 && pass "nginx -t OK" || fail "nginx -t falla"
c=$("${LOCAL[@]}" -o /dev/null -w '%{http_code}' "https://$DOMAIN/");                 [ "$c" = "200" ] && pass "apex local 200" || fail "apex local $c"
c=$("${LOCAL[@]}" -o /dev/null -w '%{http_code}' "https://www.$DOMAIN/");             [ "$c" = "301" ] && pass "www local 301" || fail "www local $c"
c=$("${LOCAL[@]}" -o /dev/null -w '%{http_code}' "https://$DOMAIN/api/products?q=davines"); [ "$c" = "200" ] && pass "API productos 200" || fail "API productos $c"
n5=$(docker logs --since 1h divinittys_nginx 2>&1 | awk '$9 ~ /^5[0-9][0-9]$/' | wc -l); [ "$n5" -eq 0 ] && pass "0 respuestas 5xx en la última hora" || warn "$n5 respuestas 5xx en la última hora"
nb=$(docker logs --since 1h divinittys_nginx 2>&1 | awk '$9 !~ /^(4|5)/ && $0 ~ /Mozilla/ && $0 !~ /(zgrab|curl|SecurityScanner|GenomeCrawler)/' | wc -l); [ "$nb" -gt 0 ] && pass "tráfico real de navegadores en la última hora: $nb requests" || warn "sin tráfico real de navegadores en la última hora"
info "renovación: ejecutar el dry-run con el entrypoint correcto (ver sección V6 del documento)"
docker run --rm -v divinittys_certbot_conf:/c:ro alpine sh -c 'for f in /c/renewal/*.conf; do echo "  $(basename $f): $(grep -E "^authenticator" $f) $(grep -E "^webroot_path|^divinittys.cl|^prep" $f | tr "\n" " ")"; done' 2>/dev/null
ps_run=$(docker ps -a --format '{{.Names}}' | grep -E 'certbot-run|importer-run'); [ -z "$ps_run" ] && pass "sin contenedores 'run' colgados" || warn "contenedores 'run' colgados: $ps_run (docker rm -f)"

# ── S9 Logs de app y workers ─────────────────────────────────
sect "S9 Errores en logs (última hora)"
for s in app workers; do
  cnt=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --no-color --since 1h "$s" 2>/dev/null | grep -c -i -E 'error|ECONNREFUSED|ENOTFOUND|unauthorized|invalid_grant|fatal')
  [ "$cnt" -eq 0 ] && pass "$s: 0 líneas de error" || warn "$s: $cnt líneas con error (revisar manualmente)"
done
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --no-color workers 2>/dev/null | grep -q 'Workers BullMQ iniciados' && pass "workers BullMQ iniciados" || fail "workers no reportan inicio"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --no-color app workers 2>/dev/null | grep -i -E '\[env\] WARN' | sort -u | head -5 | while read -r l; do warn "$l"; done

# ── S10 Host ─────────────────────────────────────────────────
sect "S10 Host"
[ "$(timedatectl show -p NTPSynchronized --value 2>/dev/null)" = "yes" ] && pass "reloj sincronizado (NTP)" || warn "reloj NO sincronizado (afecta JWT/TLS/Webpay)"
use=$(df / | awk 'NR==2{gsub("%","",$5);print $5}'); [ "$use" -lt 80 ] && pass "disco raíz ${use}%" || warn "disco raíz ${use}%"
ufw status 2>/dev/null | grep -q 'Status: active' && pass "ufw activo" || warn "ufw inactivo"
sshd -T 2>/dev/null | grep -qi '^passwordauthentication yes' && warn "SSH acepta contraseña (pasar a llaves y rotar contraseñas de root)" || pass "SSH sin contraseña"
[ -f /var/run/reboot-required ] && warn "reinicio pendiente del SO" || pass "sin reinicio pendiente"
grep -q 'max-size' /etc/docker/daemon.json 2>/dev/null && pass "rotación de logs de Docker configurada" || warn "sin rotación de logs de Docker (el disco puede llenarse)"
[ -d /home/openclaw/.openclaw ] && info "OpenClaw/Div_Bot: directorio presente; procesos=$(pgrep -fc -i openclaw 2>/dev/null) (confirmar con Rafa si debe migrarse y operar aquí)"

echo
echo "RESUMEN: PASS=$P  WARN=$W  FAIL=$F"
exit "$F"
