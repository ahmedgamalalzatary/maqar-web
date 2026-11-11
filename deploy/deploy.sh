#!/bin/sh
# Deploys the API and the admin dashboard from this PC: `sh deploy/deploy.sh` (add `--setup` the first time).
# The server keeps a Git clone of this repo and builds exactly the commit that is on origin/main,
# so what runs can always be traced to a commit. The repo is public, so no key is left there.
set -eu
KEY="$HOME/.ssh/minikoshk-ssh"
SERVER=root@187.55.224.15
REPO=https://github.com/ahmedgamalalzatary/maqar-web.git
DIR=/root/maqar
SSH="ssh -i $KEY -o IdentitiesOnly=yes -o BatchMode=yes $SERVER"

cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit your changes first: a deploy is always a pushed commit." >&2
  exit 1
fi
git fetch -q origin main
COMMIT="$(git rev-parse HEAD)"
if [ "$COMMIT" != "$(git rev-parse origin/main)" ]; then
  echo "HEAD is not origin/main. Push it first." >&2
  exit 1
fi

# The project is the folder itself. .env.production sits in it too: Git ignores it, so it stays.
$SSH "set -eu
  mkdir -p $DIR
  cd $DIR
  if [ ! -d .git ]; then git init -q; git remote add origin $REPO; fi
  git fetch -q origin main
  git checkout -q --force --detach $COMMIT"

if [ "${1:-}" = "--setup" ]; then
  $SSH "sh $DIR/deploy/setup-server.sh"
fi
$SSH "sh $DIR/deploy/server-deploy.sh $(git rev-parse --short HEAD)"

# The admin dashboard (apps/web): built here from the same clean commit, then swapped in at once.
# nginx serves /srv/maqar/web/admin at /admin/ (deploy/nginx-maqar.conf).
pnpm --filter @maqar/shared build >/dev/null
# MSYS_NO_PATHCONV: Git Bash on Windows would otherwise turn "/v1" into "C:/Program Files/Git/v1".
MSYS_NO_PATHCONV=1 NEXT_PUBLIC_API_URL=/v1 pnpm --filter @maqar/web build >/dev/null
if ! grep -rqF '"/v1"' apps/web/out/_next/static || grep -rqF 'Program Files' apps/web/out; then
  echo "The dashboard was built with the wrong API address; nothing was copied." >&2
  exit 1
fi
tar -C apps/web/out -cf - . | $SSH "set -eu
  mkdir -p /srv/maqar/web
  rm -rf /srv/maqar/web/admin.new /srv/maqar/web/admin.old
  mkdir /srv/maqar/web/admin.new
  tar -xf - -C /srv/maqar/web/admin.new
  if [ -d /srv/maqar/web/admin ]; then mv /srv/maqar/web/admin /srv/maqar/web/admin.old; fi
  mv /srv/maqar/web/admin.new /srv/maqar/web/admin
  rm -rf /srv/maqar/web/admin.old"
echo "Deployed the admin dashboard at /admin/"
