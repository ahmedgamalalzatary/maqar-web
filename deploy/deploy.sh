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

# Build and validate every artifact BEFORE anything on the server changes (OPS-06): the dashboard
# first, since a failed or wrong build here must leave the running API and dashboard untouched.
pnpm --filter @maqar/shared build >/dev/null
# MSYS_NO_PATHCONV: Git Bash on Windows would otherwise turn "/v1" into "C:/Program Files/Git/v1".
MSYS_NO_PATHCONV=1 NEXT_PUBLIC_API_URL=/v1 pnpm --filter @maqar/web build >/dev/null
if ! grep -rqF '"/v1"' apps/web/out/_next/static || grep -rqF 'Program Files' apps/web/out; then
  echo "The dashboard was built with the wrong API address; nothing was deployed." >&2
  exit 1
fi

# Now the API: built on the server, migrated, started and health-checked with rollback
# (deploy/server-deploy.sh). The dashboard build above targets this same commit's API surface.
$SSH "sh $DIR/deploy/server-deploy.sh $(git rev-parse --short HEAD)"

# Swap the dashboard in only after the new API is healthy. The previous generation of assets is
# kept once: a dashboard opened before the swap keeps loading its old hashed files (nginx serves
# /admin/ from /srv/maqar/web/admin, so an open page pointing at admin.old files still works).
tar -C apps/web/out -cf - . | $SSH "set -eu
  mkdir -p /srv/maqar/web
  rm -rf /srv/maqar/web/admin.new /srv/maqar/web/admin.old.old
  [ ! -d /srv/maqar/web/admin.old ] || mv /srv/maqar/web/admin.old /srv/maqar/web/admin.old.old
  mkdir /srv/maqar/web/admin.new
  tar -xf - -C /srv/maqar/web/admin.new
  if [ -d /srv/maqar/web/admin ]; then mv /srv/maqar/web/admin /srv/maqar/web/admin.old; fi
  mv /srv/maqar/web/admin.new /srv/maqar/web/admin
  rm -rf /srv/maqar/web/admin.old.old"

# The public pages (privacy, terms, support, account deletion): plain files, swapped in at once.
tar -C deploy/site -cf - . | $SSH "set -eu
  rm -rf /srv/maqar/web/site.new
  mkdir -p /srv/maqar/web/site.new
  tar -xf - -C /srv/maqar/web/site.new
  rm -rf /srv/maqar/web/site.old
  if [ -d /srv/maqar/web/site ]; then mv /srv/maqar/web/site /srv/maqar/web/site.old; fi
  mv /srv/maqar/web/site.new /srv/maqar/web/site
  rm -rf /srv/maqar/web/site.old"

# Maqar's nginx site, only when this commit changed it. nginx is shared with minikoshk, so the new
# file must pass nginx -t before any reload; if it does not, the previous file is put back.
$SSH "set -eu
  NEW=$DIR/deploy/nginx-maqar.conf
  LIVE=/etc/nginx/sites-available/maqar
  if ! cmp -s \"\$NEW\" \"\$LIVE\"; then
    cp \"\$LIVE\" \"\$LIVE.previous\"
    cp \"\$NEW\" \"\$LIVE\"
    if nginx -t 2>/dev/null; then
      systemctl reload nginx
      rm -f \"\$LIVE.previous\"
      echo 'nginx: Maqar site updated'
    else
      mv \"\$LIVE.previous\" \"\$LIVE\"
      nginx -t
      echo 'nginx refused the new Maqar site; the previous one is back and nothing was reloaded' >&2
      exit 1
    fi
  fi"
echo "Deployed maqar-api:$COMMIT, the admin dashboard at /admin/ and the public pages"
