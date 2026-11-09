#!/bin/sh
# One-time setup, safe to run again. The server also runs another live project: this script only
# adds Maqar's own folders, secrets, build helper and site. It changes nothing else.
set -eu
HOST=187-55-224-15.sslip.io
SRC=/root/maqar

mkdir -p /srv/maqar/uploads /var/www/maqar-acme
chown -R 1000:1000 /srv/maqar/uploads   # the "node" user in the API image
chmod 755 /srv/maqar /srv/maqar/uploads
chmod 700 /root/maqar

# Secrets are made here and stay here. They are never printed.
ENV_FILE=/root/maqar/.env.production
if [ ! -f "$ENV_FILE" ]; then
  db_password="$(openssl rand -hex 24)"
  touch "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  cat > "$ENV_FILE" <<EOF
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)
MYSQL_DATABASE=maqar
MYSQL_USER=maqar
MYSQL_PASSWORD=$db_password
DATABASE_URL=mysql://maqar:$db_password@mysql:3306/maqar
JWT_ACCESS_SECRET=$(openssl rand -hex 48)
JWT_ACCESS_TTL=15m
REFRESH_TTL_DAYS=30
AUTH_RATE_LIMIT=10
UPLOADS_DIR=uploads
SEED_PASSWORD=$(openssl rand -hex 12)
EOF
  echo "Created $ENV_FILE"
fi

# Builds run at half a CPU, so the other project keeps responding during a build.
docker buildx inspect maqar-builder >/dev/null 2>&1 || docker buildx create --name maqar-builder \
  --driver docker-container --driver-opt cpu-period=100000,cpu-quota=50000,memory=1500m,memory-swap=2500m >/dev/null

# Installs a site file; a config nginx refuses is taken out again, so the other sites stay up.
install_site() {
  ln -sf "$1" /etc/nginx/sites-enabled/zz-maqar
  if ! nginx -t 2>/dev/null; then
    rm -f /etc/nginx/sites-enabled/zz-maqar
    nginx -t
    echo "nginx refused the Maqar site; removed it" >&2
    exit 1
  fi
  systemctl reload nginx
}

if [ ! -f "/etc/letsencrypt/live/$HOST/fullchain.pem" ]; then
  # Port 80 only, just long enough to prove the name for the certificate.
  cat > /etc/nginx/sites-available/maqar-acme <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $HOST;
    location /.well-known/acme-challenge/ { root /var/www/maqar-acme; }
    location / { return 404; }
}
EOF
  install_site /etc/nginx/sites-available/maqar-acme
  certbot certonly --webroot -w /var/www/maqar-acme -d "$HOST" --non-interactive --agree-tos \
    --register-unsafely-without-email --deploy-hook 'nginx -t && systemctl reload nginx'
fi
cp "$SRC/deploy/nginx-maqar.conf" /etc/nginx/sites-available/maqar
install_site /etc/nginx/sites-available/maqar
rm -f /etc/nginx/sites-available/maqar-acme

echo "Server ready"
