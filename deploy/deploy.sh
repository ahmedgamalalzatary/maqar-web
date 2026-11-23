#!/bin/sh
# Deploys the API and the admin dashboard from this PC: `sh deploy/deploy.sh` (add `--setup` the first time).
# The server keeps a Git clone of this repo and builds exactly the commit that is on origin/main,
# so what runs can always be traced to a commit. The repo is public, so no key is left there.
#
# Everything it prints also goes to .dev-logs/deploy.log. A failed deploy ends with a
# "DEPLOY FAILED" block naming the step, the reason, what is still running and where the backup is.
# The database backup the server takes before migrating is deleted only when every step and the
# final live check are green.
set -eu
KEY="$HOME/.ssh/maqar-ssh"
SERVER=root@2.24.152.130
HOST=https://mqr.systems
REPO=https://github.com/ahmedgamalalzatary/maqar-web.git
DIR=/root/mqr
SSH="ssh -i $KEY -o IdentitiesOnly=yes -o BatchMode=yes $SERVER"

cd "$(git rev-parse --show-toplevel)"
LOG=.dev-logs/deploy.log

# Run once more with the output copied to the log; the inner run's exit code comes back by file,
# since a pipe in sh only reports tee's.
if [ -z "${MQR_DEPLOY_INNER:-}" ]; then
  mkdir -p .dev-logs
  rm -f "$LOG.status"
  MQR_DEPLOY_INNER=1 sh deploy/deploy.sh "$@" 2>&1 | tee "$LOG"
  exit "$(cat "$LOG.status" 2>/dev/null || echo 1)"
fi

STEP=checks
BACKUP=
finish() {
  code=$?
  echo "$code" > "$LOG.status"
  [ "$code" -eq 0 ] && return
  echo ""
  echo "DEPLOY FAILED at step: $STEP (exit $code)"
  case "$STEP" in
    checks) echo "Nothing was sent to the server." ;;
    checkout) echo "The server's clone may be on the new commit, but nothing was built or restarted." ;;
    dashboard-build) echo "The dashboard did not build on the server; nothing running was touched. See the build output above." ;;
    server) echo "See the SERVER STEP FAILED block above for what the server did and what still runs." ;;
    dashboard-swap) echo "The new API is live, but the dashboard swap failed: the previous dashboard may still be served." ;;
    site-swap) echo "The new API and dashboard are live; the public pages (privacy, terms…) did not update." ;;
    nginx) echo "The new API and dashboard are live; nginx refused the new MQR site, so the old one stays." ;;
    live-check) echo "Every step ran, but the live check through nginx failed (see above)." ;;
  esac
  [ -z "$BACKUP" ] || echo "Database backup kept on the server: $BACKUP (if the server got as far as taking it)"
  echo "Full log: $LOG"
}
trap finish EXIT

if [ -n "$(git status --porcelain)" ]; then
  echo "Commit your changes first: a deploy is always a pushed commit." >&2
  exit 1
fi
git fetch -q origin main
COMMIT="$(git rev-parse HEAD)"
TAG="$(git rev-parse --short HEAD)"
if [ "$COMMIT" != "$(git rev-parse origin/main)" ]; then
  echo "HEAD is not origin/main. Push it first." >&2
  exit 1
fi
BACKUP="/root/mqr-backups/pre-deploy-$TAG.sql.gz"
echo "== Deploying $TAG"

# The project is the folder itself. .env.production sits in it too: Git ignores it, so it stays.
STEP=checkout
$SSH "set -eu
  mkdir -p $DIR
  cd $DIR
  if [ ! -d .git ]; then git init -q; git remote add origin $REPO; fi
  git fetch -q origin main
  git checkout -q --force --detach $COMMIT"

if [ "${1:-}" = "--setup" ]; then
  STEP=setup
  $SSH "sh $DIR/deploy/setup-server.sh"
fi

# Build and validate every artifact BEFORE anything on the server changes (OPS-06): the dashboard
# first, since a failed or wrong build here must leave the running API and dashboard untouched.
STEP=dashboard-build
echo "== Building the dashboard (on the server)"
$SSH "sh $DIR/deploy/build-dashboard.sh"

# Now the API: built on the server, backed up, migrated, started and health-checked with rollback
# (deploy/server-deploy.sh). The dashboard build above targets this same commit's API surface.
STEP=server
$SSH "sh $DIR/deploy/server-deploy.sh $TAG"

# Swap the dashboard in only after the new API is healthy. The previous generation of assets is
# kept once: a dashboard opened before the swap keeps loading its old hashed files (nginx serves
# /admin/ from /srv/mqr/web/admin, so an open page pointing at admin.old files still works).
STEP=dashboard-swap
echo "== Swapping in the dashboard"
$SSH "set -eu
  rm -rf /srv/mqr/web/admin.old.old
  [ ! -d /srv/mqr/web/admin.old ] || mv /srv/mqr/web/admin.old /srv/mqr/web/admin.old.old
  if [ -d /srv/mqr/web/admin ]; then mv /srv/mqr/web/admin /srv/mqr/web/admin.old; fi
  mv /srv/mqr/web/admin.build /srv/mqr/web/admin
  rm -rf /srv/mqr/web/admin.old.old"

# The public pages (privacy, terms, support, account deletion): plain files, swapped in at once.
STEP=site-swap
tar -C deploy/site -cf - . | $SSH "set -eu
  rm -rf /srv/mqr/web/site.new
  mkdir -p /srv/mqr/web/site.new
  tar -xf - -C /srv/mqr/web/site.new
  rm -rf /srv/mqr/web/site.old
  if [ -d /srv/mqr/web/site ]; then mv /srv/mqr/web/site /srv/mqr/web/site.old; fi
  mv /srv/mqr/web/site.new /srv/mqr/web/site
  rm -rf /srv/mqr/web/site.old"

# MQR's nginx site, only when this commit changed it. A broken file would take nginx down, so the new
# file must pass nginx -t before any reload; if it does not, the previous file is put back.
STEP=nginx
$SSH "set -eu
  NEW=$DIR/deploy/nginx-mqr.conf
  LIVE=/etc/nginx/sites-available/mqr
  if ! cmp -s \"\$NEW\" \"\$LIVE\"; then
    cp \"\$LIVE\" \"\$LIVE.previous\"
    cp \"\$NEW\" \"\$LIVE\"
    if nginx -t 2>/dev/null; then
      systemctl reload nginx
      rm -f \"\$LIVE.previous\"
      echo 'nginx: MQR site updated'
    else
      mv \"\$LIVE.previous\" \"\$LIVE\"
      nginx -t
      echo 'nginx refused the new MQR site; the previous one is back and nothing was reloaded' >&2
      exit 1
    fi
  fi"

# The live check goes through nginx from outside, as a phone would.
STEP=live-check
echo "== Checking the live site"
for path in /v1/health /v1/settings /admin/ /privacy; do
  status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$HOST$path" || echo 000)"
  echo "$status $path"
  if [ "$status" != 200 ]; then
    echo "$HOST$path answered $status, not 200" >&2
    exit 1
  fi
done

# Green: the backup is not needed any more.
STEP=cleanup
$SSH "rm -f $BACKUP"
echo "Backup removed: $BACKUP"
STEP=done
echo "Deployed mqr-api:$COMMIT, the admin dashboard at /admin/ and the public pages"
