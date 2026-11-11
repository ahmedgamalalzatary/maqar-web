#!/bin/sh
# Runs on the server, from deploy/deploy.sh: build, migrate, start, check, roll back.
# It only ever acts on Maqar's compose project. This server is temporary, so there are no backups.
#
# Version pairing (OPS-06): the dashboard is built and validated on the PC before this script runs,
# and its swap happens after the new API is healthy. So migrations must stay backward-compatible
# with the previous API image and the previous dashboard: additive tables/columns first; renaming
# or dropping columns waits for the deploy after the code that stops using them is live. An
# interrupted deploy recovers as: a failed build changes nothing; a failed migration leaves the old
# API running (a half-applied migration is retried by the next run); an unhealthy new API is
# rolled back to the previous image.
set -eu
TAG="$1"
SRC=/root/maqar
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
