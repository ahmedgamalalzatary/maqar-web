#!/bin/sh
# Deploys the API from this PC: `sh deploy/deploy.sh` (add `--setup` the first time).
# The server keeps a Git clone of this repo and builds exactly the commit that is on origin/main,
# so what runs can always be traced to a commit. The repo is public, so no key is left there.
set -eu
KEY="$HOME/.ssh/minikoshk-ssh"
SERVER=root@187.55.224.15
REPO=https://github.com/ahmedgamalalzatary/maqar-web.git
SRC=/root/maqar/src
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

$SSH "set -eu
  mkdir -p /root/maqar
  if [ ! -d $SRC/.git ]; then rm -rf $SRC; git clone -q $REPO $SRC; fi
  git -C $SRC fetch -q origin main
  git -C $SRC checkout -q --force --detach $COMMIT"

if [ "${1:-}" = "--setup" ]; then
  $SSH "sh $SRC/deploy/setup-server.sh"
fi
$SSH "sh $SRC/deploy/server-deploy.sh $(git rev-parse --short HEAD)"
