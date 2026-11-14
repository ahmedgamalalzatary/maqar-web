#!/bin/sh
# Runs on the server, from deploy/deploy.sh: build, back up, migrate, start, check, roll back.
# It only ever acts on Maqar's compose project.
#
# Version pairing (OPS-06): the dashboard is built and validated on the PC before this script runs,
# and its swap happens after the new API is healthy. So migrations must stay backward-compatible
# with the previous API image and the previous dashboard: additive tables/columns first; renaming
# or dropping columns waits for the deploy after the code that stops using them is live. An
# interrupted deploy recovers as: a failed build changes nothing; a failed migration leaves the old
# API running (a half-applied migration is retried by the next run); an unhealthy new API is
# rolled back to the previous image.
#
# Backup: the database is dumped right before the migrations to /root/maqar-backups/pre-deploy-<tag>.sql.gz.
# deploy.sh deletes it only after the whole deploy is green; a failed deploy keeps it for a restore.
# Uploaded files are not copied: no migration touches them, and they never leave /srv/maqar/uploads.
set -eu
TAG="$1"
SRC=/root/maqar
COMPOSE="docker compose -f $SRC/docker-compose.yml"
BACKUP_DIR=/root/maqar-backups
BACKUP="$BACKUP_DIR/pre-deploy-$TAG.sql.gz"
PREVIOUS="$(docker inspect --format '{{.Config.Image}}' maqar-api 2>/dev/null || true)"
STEP=start

# Whatever goes wrong, say where, so the person (or agent) reading the log knows what to look at.
report() {
  code=$?
  [ "$code" -eq 0 ] && return
  echo "" >&2
  echo "SERVER STEP FAILED: $STEP (exit $code)" >&2
  case "$STEP" in
    build) echo "Nothing changed on the server: the old API is still running." >&2 ;;
    backup) echo "No migration ran and the old API is still running." >&2 ;;
    migrate) echo "The old API is still running. The database may be half-migrated; the next deploy retries it." >&2 ;;
    start) echo "The new API never became healthy; it was rolled back to ${PREVIOUS:-nothing (no previous image)}." >&2 ;;
  esac
  if [ -f "$BACKUP" ]; then
    echo "The database backup taken before the migration is kept: $BACKUP" >&2
    echo "Restore it with: gunzip -c $BACKUP | docker exec -i maqar-mysql sh -c 'MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysql -uroot \"\$MYSQL_DATABASE\"'" >&2
  fi
}
trap report EXIT

STEP=build
echo "== Building maqar-api:$TAG"
docker buildx build --builder maqar-builder --load -t "maqar-api:$TAG" -f "$SRC/Dockerfile.api" "$SRC"
docker stop "$(docker ps -q --filter name=buildx_buildkit_maqar-builder)" >/dev/null 2>&1 || true

export MAQAR_TAG="$TAG"
STEP=database
echo "== Starting the database"
$COMPOSE up -d --wait mysql

# The dump runs inside the database container with its own root password; nothing is printed.
# A dump is trusted only if gzip reads it back and mysqldump wrote its closing line.
STEP=backup
echo "== Backing up the database to $BACKUP"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
rm -f "$BACKUP.part"
docker exec maqar-mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --triggers --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"' > "$BACKUP.sql.part"
gzip -c "$BACKUP.sql.part" > "$BACKUP.part"
rm -f "$BACKUP.sql.part"
if ! gzip -t "$BACKUP.part" || ! gunzip -c "$BACKUP.part" | tail -n 1 | grep -q 'Dump completed'; then
  rm -f "$BACKUP.part"
  echo "The database dump is incomplete" >&2
  exit 1
fi
mv "$BACKUP.part" "$BACKUP"
echo "Backup ready ($(du -h "$BACKUP" | cut -f1))"

# A failed migration stops here, and the old API keeps running.
STEP=migrate
echo "== Running migrations"
$COMPOSE run --rm --no-deps -T api node dist/core/db/run-migrations.js

STEP=start
echo "== Starting the new API"
if ! $COMPOSE up -d --wait --wait-timeout 90 api; then
  echo "The new API is not healthy. Its last health checks:" >&2
  docker inspect --format '{{range .State.Health.Log}}{{.ExitCode}} {{.Output}}{{end}}' maqar-api >&2 || true
  echo "Its last log lines:" >&2
  $COMPOSE logs --no-color --tail 60 api >&2 || true
  if [ -n "$PREVIOUS" ] && docker image inspect "$PREVIOUS" >/dev/null 2>&1; then
    echo "Rolling back to $PREVIOUS" >&2
    MAQAR_TAG="${PREVIOUS#maqar-api:}" $COMPOSE up -d api
  fi
  exit 1
fi
STEP=done
echo "Deployed maqar-api:$TAG"
