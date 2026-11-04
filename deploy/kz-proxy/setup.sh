#!/usr/bin/env bash
# Қазақстандағы VPS-ке (Ubuntu 22.04/24.04) grantup.kz прокси-серверін орнату.
# Қолданылуы (серверде, root ретінде):
#   DOMAIN=grantup.kz UPSTREAM=grantup-alpha.vercel.app PROXY_SECRET=... EMAIL=admin@example.com bash setup.sh
# PROXY_SECRET — Vercel-дегі PROXY_SHARED_SECRET-пен бірдей (кемінде 32 таңба).
set -euo pipefail

: "${DOMAIN:?DOMAIN керек (мысалы grantup.kz)}"
: "${UPSTREAM:?UPSTREAM керек (мысалы grantup-alpha.vercel.app)}"
: "${PROXY_SECRET:?PROXY_SECRET керек}"
: "${EMAIL:?EMAIL керек (Let's Encrypt хабарламалары үшін)}"
if [ "${#PROXY_SECRET}" -lt 32 ]; then echo "PROXY_SECRET кемінде 32 таңба болуы керек" >&2; exit 1; fi

HERE="$(cd "$(dirname "$0")" && pwd)"
export DEBIAN_FRONTEND=noninteractive

echo "==> Пакеттер: nginx, certbot, файрвол"
apt-get update -y
apt-get install -y nginx certbot gettext-base ufw unattended-upgrades
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

mkdir -p /var/www/certbot

echo "==> SSL сертификатына дейін уақытша HTTP конфиг"
cat > /etc/nginx/sites-available/grantup.conf <<CONF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 "GrantUp proxy: SSL күтілуде\n"; }
}
CONF
ln -sf /etc/nginx/sites-available/grantup.conf /etc/nginx/sites-enabled/grantup.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Let's Encrypt сертификаты (${DOMAIN}, www.${DOMAIN})"
certbot certonly --webroot -w /var/www/certbot -d "${DOMAIN}" -d "www.${DOMAIN}" \
  --email "${EMAIL}" --agree-tos --non-interactive --keep-until-expiring

echo "==> Толық прокси конфигі"
export DOMAIN UPSTREAM PROXY_SECRET
envsubst '${DOMAIN} ${UPSTREAM} ${PROXY_SECRET}' < "${HERE}/grantup.conf.template" > /etc/nginx/sites-available/grantup.conf
chmod 640 /etc/nginx/sites-available/grantup.conf
nginx -t && systemctl reload nginx

# Сертификат жаңарғанда nginx қайта жүктелсін (certbot таймері автоматты жаңартады)
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

echo "==> Дайын: https://${DOMAIN}"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" "https://${DOMAIN}/robots.txt" || true
