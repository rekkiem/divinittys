#!/usr/bin/env bash
# ============================================================
# DIVINITTYS — verify-external.sh
# Verifica la migración "desde afuera" (como lo ve un cliente o Googlebot).
# SOLO LECTURA. No requiere secretos. Ejecutar desde cualquier máquina
# con bash, curl, dig y openssl (no desde dentro del VPS nuevo, para que
# el DNS que se pruebe sea el público).
#
# Uso:  bash verify-external.sh
# Exit code = número de FAIL (0 = todo OK).
# ============================================================
set -uo pipefail

DOMAIN="${DOMAIN:-divinittys.cl}"
NEW_IP="${NEW_IP:-64.176.22.16}"
OLD_IP="${OLD_IP:-64.176.21.152}"
SAMPLE_PRODUCT="${SAMPLE_PRODUCT:-davines-nourishing-shampoo-250-ml-mlc4091632308}"
SAMPLE_IMAGE="${SAMPLE_IMAGE:-https://media.${DOMAIN}/imagenes/products/ml-MLC4009227764-0/1787196023580-2c8xe6.webp}"
CURL=(curl -sS -m 20)

P=0; F=0; W=0
pass() { echo "  [PASS] $1"; P=$((P+1)); }
fail() { echo "  [FAIL] $1"; F=$((F+1)); }
warn() { echo "  [WARN] $1"; W=$((W+1)); }
sect() { echo; echo "== $1"; }

need() { command -v "$1" >/dev/null 2>&1 || { echo "Falta '$1' en esta máquina"; exit 99; }; }
need curl; need dig; need openssl

code() { "${CURL[@]}" -o /dev/null -w '%{http_code}' "$@" 2>/dev/null || true; }

# ── E1. DNS ──────────────────────────────────────────────────
sect "E1 DNS (todos los hosts deben apuntar al VPS nuevo)"
for host in "$DOMAIN" "www.$DOMAIN" "media.$DOMAIN" "prep.$DOMAIN"; do
  for ns in 1.1.1.1 8.8.8.8 9.9.9.9 dns1.50webs.com dns2.50webs.com; do
    got=$(dig +short +time=3 +tries=1 A "$host" @"$ns" | tr '\n' ' ' | sed 's/ $//')
    if [ "$got" = "$NEW_IP" ]; then pass "$host @$ns -> $got"
    elif [ -z "$got" ]; then warn "$host @$ns sin respuesta"
    else fail "$host @$ns -> '$got' (esperado $NEW_IP)"; fi
  done
done
aaaa=$(dig +short AAAA "$DOMAIN" @1.1.1.1)
[ -z "$aaaa" ] && pass "sin registro AAAA" || fail "AAAA presente: $aaaa (puede enviar tráfico a otro servidor)"

sect "E1b DNS de correo (no debe haber cambiado)"
dig +short MX "$DOMAIN" @1.1.1.1 | grep -qi "mail.50webs.com" && pass "MX apunta a mail.50webs.com" || fail "MX inesperado: $(dig +short MX "$DOMAIN" @1.1.1.1)"
dig +short TXT "$DOMAIN" @1.1.1.1 | grep -qi "v=spf1" && pass "SPF presente" || fail "SPF ausente"
dig +short TXT "_dmarc.$DOMAIN" @1.1.1.1 | grep -qi "v=DMARC1" && pass "DMARC presente" || warn "DMARC ausente"
for sel in brevo1._domainkey brevo2._domainkey; do
  [ -n "$(dig +short CNAME "$sel.$DOMAIN" @1.1.1.1)" ] && pass "DKIM Brevo $sel presente" || fail "DKIM Brevo $sel ausente"
done

# ── E2. TLS ──────────────────────────────────────────────────
sect "E2 TLS / certificados"
for host in "$DOMAIN" "www.$DOMAIN" "media.$DOMAIN"; do
  cert=$(echo | openssl s_client -connect "$host:443" -servername "$host" 2>/dev/null | openssl x509 2>/dev/null)
  if [ -z "$cert" ]; then fail "$host: sin certificado"; continue; fi
  end=$(echo "$cert" | openssl x509 -noout -enddate | cut -d= -f2)
  if echo "$cert" | openssl x509 -noout -checkend $((30*86400)) >/dev/null; then pass "$host vence $end (>30 días)"; else fail "$host vence $end (<30 días)"; fi
  san=$(echo "$cert" | openssl x509 -noout -ext subjectAltName 2>/dev/null)
  echo "$san" | grep -q "DNS:$host" && pass "$host cubierto por SAN" || fail "$host NO está en el SAN del certificado"
  [ "$(code "https://$host/")" != "000" ] && pass "$host: cadena confiable (curl sin -k)" || fail "$host: curl sin -k falla (cadena o hostname)"
done

# ── Precheck de conectividad (evita falsos PASS cuando no hay red) ──
if [ "$(code "https://$DOMAIN/")" = "000" ]; then
  sect "E3-E5 OMITIDOS"
  fail "sin conectividad HTTPS a $DOMAIN desde esta máquina (red, proxy o servidor caído). Ejecutar desde un equipo con salida libre a Internet"
  echo; echo "RESUMEN: PASS=$P  WARN=$W  FAIL=$F"; exit "$F"
fi

# ── E3. Respuestas HTTP ──────────────────────────────────────
sect "E3 HTTP"
c=$(code "http://$DOMAIN/");                       [ "$c" = "301" ] && pass "http apex -> 301" || fail "http apex -> $c"
loc=$("${CURL[@]}" -o /dev/null -w '%{redirect_url}' "http://$DOMAIN/x?y=1" 2>/dev/null)
[ "$loc" = "https://$DOMAIN/x?y=1" ] && pass "redirect http->https conserva ruta y query" || fail "redirect http: '$loc'"
loc=$("${CURL[@]}" -o /dev/null -w '%{redirect_url}' "https://www.$DOMAIN/productos" 2>/dev/null)
[ "$loc" = "https://$DOMAIN/productos" ] && pass "www -> apex 301" || fail "www redirect: '$loc'"
body=$("${CURL[@]}" "https://$DOMAIN/" 2>/dev/null)
c=$(code "https://$DOMAIN/");                      [ "$c" = "200" ] && pass "home 200" || fail "home -> $c"
echo "$body" | grep -q "DIVINITTYS" && pass "home contiene la tienda (marca DIVINITTYS)" || fail "home NO parece la tienda (¿web antigua?)"
echo "$body" | grep -qi -E "mercadolibre\.cl|meta http-equiv=.refresh" && fail "home contiene redirección/enlace de la web antigua a ML" || pass "sin rastro de la web antigua"
echo "$body" | grep -q -E "$OLD_IP|$NEW_IP" && fail "el HTML expone una IP literal (revisar NEXT_PUBLIC_APP_URL)" || pass "HTML sin IPs literales"
for path in /productos "/productos?category=shampoo" "/productos/$SAMPLE_PRODUCT" /cuenta/login /wishlist /asistente-belleza /diagnostico-capilar /contacto /about /faq /envios /devoluciones /privacidad /terminos /robots.txt /sitemap.xml; do
  c=$(code "https://$DOMAIN$path"); [ "$c" = "200" ] && pass "GET $path 200" || fail "GET $path -> $c"
done
c=$(code "https://$DOMAIN/api/health"); [ "$c" = "200" ] && pass "/api/health 200 (OJO: es superficial, no prueba DB)" || fail "/api/health -> $c"
resp=$("${CURL[@]}" "https://$DOMAIN/api/products?q=davines" 2>/dev/null)
echo "$resp" | grep -qi "davines" && pass "búsqueda /api/products?q=davines devuelve resultados" || fail "búsqueda sin resultados (Meilisearch/DB). Respuesta: ${resp:0:120}"
c=$(code "https://$DOMAIN/ruta-que-no-existe-$RANDOM"); [ "$c" = "404" ] && pass "404 real en ruta inexistente" || warn "ruta inexistente -> $c"
t=$("${CURL[@]}" -o /dev/null -w '%{time_total}' "https://$DOMAIN/" 2>/dev/null); awk "BEGIN{exit !($t<2.0)}" && pass "home responde en ${t}s" || warn "home lenta: ${t}s"

# ── E4. Medios (MinIO detrás de media.<dominio>) ─────────────
sect "E4 Medios"
hdr=$("${CURL[@]}" -I "$SAMPLE_IMAGE" 2>/dev/null)
echo "$hdr" | head -1 | grep -q " 200" && pass "imagen directa 200" || fail "imagen directa: $(echo "$hdr" | head -1)"
echo "$hdr" | grep -qi "content-type: image/" && pass "content-type de imagen" || fail "content-type no es imagen"
path="${SAMPLE_IMAGE#https://media.$DOMAIN}"
enc="${path//\//%2F}"
c=$(code "https://$DOMAIN/_next/image?url=%2Fmedia${enc}&w=640&q=75"); [ "$c" = "200" ] && pass "optimizador next/image 200" || fail "next/image -> $c"
c=$(code "https://media.$DOMAIN/"); case "$c" in 403|404|400|000) pass "raíz de media no lista el bucket ($c)";; *) fail "raíz de media -> $c (¿listado público?)";; esac

# ── E5. Superficie cerrada ───────────────────────────────────
sect "E5 Superficie expuesta"
for path in /.env /.env.production /.git/config /env.zip /docker-compose.prod.yml /api/admin/products; do
  c=$(code "https://$DOMAIN$path")
  case "$c" in 200) fail "$path -> 200 (EXPUESTO)";; 000) warn "$path sin respuesta (¿444?)";; *) pass "$path -> $c";; esac
done
c=$(code "https://$DOMAIN/api/admin/products"); case "$c" in 401|403) pass "API admin exige auth ($c)";; *) warn "API admin sin auth devolvió $c";; esac
c=$(code -X POST "https://$DOMAIN/api/cron/cleanup-abandoned-orders"); case "$c" in 401|403) pass "cron protegido ($c)";; *) fail "cron sin secreto devolvió $c";; esac
c=$(code -X POST -H 'Content-Type: application/json' -d '{}' "https://$DOMAIN/api/webhooks/mercadopago"); case "$c" in 200|400|401|403) pass "webhook MP alcanzable ($c)";; *) fail "webhook MP -> $c (404/5xx = no llega a la app)";; esac
for h in strict-transport-security x-frame-options x-content-type-options; do
  "${CURL[@]}" -I "https://$DOMAIN/" 2>/dev/null | grep -qi "^$h:" && pass "header $h" || fail "falta header $h"
done
"${CURL[@]}" -I "https://$DOMAIN/" 2>/dev/null | grep -qi "^x-powered-by" && warn "x-powered-by expuesto" || pass "sin x-powered-by"
for u in "http://$NEW_IP/" "https://$NEW_IP/"; do
  c=$("${CURL[@]}" -k -o /dev/null -w '%{http_code}' "$u" 2>/dev/null; echo "exit=$?")
  echo "$c" | grep -q -E "^000.*exit=52|^000exit=52" && pass "$u cerrado (444)" || warn "$u -> $c (esperado: respuesta vacía)"
done
c=$("${CURL[@]}" -k -o /dev/null -w '%{http_code}' "https://prep.$DOMAIN/" 2>/dev/null); [ "$c" = "000" ] && pass "prep deprecado (444)" || warn "prep -> $c"

# ── E6. Estado del servidor viejo ────────────────────────────
sect "E6 Servidor viejo ($OLD_IP) — informativo antes de decomisionar"
c=$("${CURL[@]}" -k -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:$OLD_IP" "https://$DOMAIN/api/health" 2>/dev/null)
if [ "$c" = "200" ]; then warn "el VPS viejo AÚN sirve la tienda (rollback disponible; apagar app/workers al decomisionar)"; else pass "el VPS viejo no sirve la tienda ($c)"; fi

echo
echo "RESUMEN: PASS=$P  WARN=$W  FAIL=$F"
exit "$F"
