#!/bin/sh
# One-time setup, safe to run again. This script only adds MQR's own folders, secrets, build
# helper and site. It changes nothing else on the server.
set -eu
HOST=mqr.systems
SRC=/root/mqr

mkdir -p /srv/mqr/uploads /var/www/mqr-acme
chown -R 1000:1000 /srv/mqr/uploads   # the "node" user in the API image
chmod 755 /srv/mqr /srv/mqr/uploads
chmod 700 /root/mqr

# Secrets are made here and stay here. They are never printed.
ENV_FILE=/root/mqr/.env.production
if [ ! -f "$ENV_FILE" ]; then
  db_password="$(openssl rand -hex 24)"
  touch "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  cat > "$ENV_FILE" <<EOF
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)
MYSQL_DATABASE=mqr
MYSQL_USER=mqr
MYSQL_PASSWORD=$db_password
DATABASE_URL=mysql://mqr:$db_password@mysql:3306/mqr
JWT_ACCESS_SECRET=$(openssl rand -hex 48)
JWT_ACCESS_TTL=15m
REFRESH_TTL_DAYS=30
AUTH_RATE_LIMIT=10
UPLOADS_DIR=uploads
SEED_PASSWORD=$(openssl rand -hex 12)
EOF
  echo "Created $ENV_FILE"
fi

# Builds run at half a CPU, so the live API keeps responding during a build.
docker buildx inspect mqr-builder >/dev/null 2>&1 || docker buildx create --name mqr-builder \
  --driver docker-container --driver-opt cpu-period=100000,cpu-quota=50000,memory=1500m,memory-swap=2500m >/dev/null

# Installs a site file; a config nginx refuses is taken out again, so nginx stays up.
install_site() {
  ln -sf "$1" /etc/nginx/sites-enabled/zz-mqr
  if ! nginx -t 2>/dev/null; then
    rm -f /etc/nginx/sites-enabled/zz-mqr
    nginx -t
    echo "nginx refused the MQR site; removed it" >&2
    exit 1
  fi
  systemctl reload nginx
}

if [ ! -f "/etc/letsencrypt/live/$HOST/fullchain.pem" ]; then
  # Port 80 only, just long enough to prove the name for the certificate.
  cat > /etc/nginx/sites-available/mqr-acme <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $HOST www.$HOST;
    location /.well-known/acme-challenge/ { root /var/www/mqr-acme; }
    location / { return 404; }
}
EOF
  install_site /etc/nginx/sites-available/mqr-acme
  certbot certonly --webroot -w /var/www/mqr-acme -d "$HOST" -d "www.$HOST" --non-interactive --agree-tos \
    --register-unsafely-without-email --deploy-hook 'nginx -t && systemctl reload nginx'
fi
cp "$SRC/deploy/nginx-mqr.conf" /etc/nginx/sites-available/mqr
install_site /etc/nginx/sites-available/mqr
rm -f /etc/nginx/sites-available/mqr-acme

echo "Server ready"
