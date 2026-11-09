#!/bin/sh
# Runs on the server, from deploy/deploy.sh: build, migrate, start, check, roll back.
# It only ever acts on Maqar's compose project. This server is temporary, so there are no backups.
set -eu
TAG="$1"
SRC=/root/maqar/src
COMPOSE="docker compose -f $SRC/docker-compose.yml"
PREVIOUS="$(docker inspect --format '{{.Config.Image}}' maqar-api 2>/dev/null || true)"

echo "Building maqar-api:$TAG"
docker buildx build --builder maqar-builder --load -t "maqar-api:$TAG" -f "$SRC/Dockerfile.api" "$SRC"
docker stop "$(docker ps -q --filter name=buildx_buildkit_maqar-builder)" >/dev/null 2>&1 || true

export MAQAR_TAG="$TAG"
$COMPOSE up -d --wait mysql

# A failed migration stops here, and the old API keeps running.
$COMPOSE run --rm --no-deps -T api node dist/core/db/run-migrations.js

if ! $COMPOSE up -d --wait --wait-timeout 90 api; then
  echo "The new API is not healthy" >&2
  $COMPOSE logs --tail 30 api >&2 || true
  if [ -n "$PREVIOUS" ] && docker image inspect "$PREVIOUS" >/dev/null 2>&1; then
    echo "Rolling back to $PREVIOUS" >&2
    MAQAR_TAG="${PREVIOUS#maqar-api:}" $COMPOSE up -d api
  fi
  exit 1
fi
echo "Deployed maqar-api:$TAG"
