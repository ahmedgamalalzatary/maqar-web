#!/bin/sh
# Builds the admin dashboard (apps/web) ON THE SERVER, in a throwaway Node container, from the commit
# deploy.sh just checked out in /root/mqr. The result goes to /srv/mqr/web/admin.build; deploy.sh
# swaps it in only after the new API is healthy. Nothing running is touched here.
set -eu
SRC=/root/mqr
OUT=/srv/mqr/web/admin.build

rm -rf "$OUT"
mkdir -p "$OUT"

# One CPU and a memory cap, so the live API keeps answering during the build. The pnpm store is
# kept in a named volume, so later builds don't download every package again.
docker run --rm --cpus 1 --memory 2g \
  -v "$SRC":/src:ro \
  -v "$OUT":/out \
  -v mqr-pnpm-store:/pnpm-store \
  -e NEXT_PUBLIC_API_URL=/v1 \
  -e NEXT_TELEMETRY_DISABLED=1 \
  node:22-slim sh -euc '
    corepack enable >/dev/null
    mkdir /build
    cd /src
    tar --exclude=./node_modules --exclude="./apps/*/node_modules" --exclude="./packages/*/node_modules" \
        --exclude=./apps/web/.next --exclude=./apps/web/out --exclude=./.git -cf - . | tar -xf - -C /build
    cd /build
    pnpm config set store-dir /pnpm-store >/dev/null
    pnpm install --frozen-lockfile --filter @mqr/web... --reporter=silent
    pnpm --filter @mqr/shared build
    pnpm --filter @mqr/web build
    cp -r apps/web/out/. /out/
  '

if ! grep -rqF '"/v1"' "$OUT/_next/static"; then
  echo "The dashboard was built with the wrong API address; nothing was deployed." >&2
  exit 1
fi
echo "Dashboard built in $OUT"
