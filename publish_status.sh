#!/usr/bin/env bash
# Probe every camera and publish the result to the `status` branch.
# The site reads that branch instead of probing ~714 streams per visitor.
# Run from cron every 6 hours; see docs/deploy.md.
set -euo pipefail
export GIT_TERMINAL_PROMPT=0

for f in "${CCTV_ENV_FILE:-}" /etc/cctv-status.env "${HOME:-/nonexistent}/.config/cctv-status.env"; do
  if [ -n "$f" ] && [ -r "$f" ]; then . "$f"; break; fi
done
: "${GITHUB_TOKEN:?GITHUB_TOKEN is not set (see docs/deploy.md)}"

REPO=${GITHUB_REPO:-apikdech/cctv}
BRANCH=${STATUS_BRANCH:-status}
WORK_DIR=${WORK_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}
PYTHON=${PYTHON:-python3}

cd "$WORK_DIR"

# A hung sweep must not overlap the next cron run.
command -v flock >/dev/null || { echo "flock is missing (install util-linux)" >&2; exit 1; }
exec 9>/tmp/cctv-status.lock
flock -n 9 || { echo "already running"; exit 0; }

echo "cctv-status: $(date -u +%FT%TZ) fetching main in $WORK_DIR"
git fetch -q --depth 1 origin main
git reset -q --hard FETCH_HEAD

"$PYTHON" probe_status.py

git fetch -q --depth 1 origin "$BRANCH" || {
  echo "status branch '$BRANCH' is missing; create it first (docs/deploy.md)" >&2
  exit 1
}
git worktree prune
tmp=$(mktemp -d)
trap 'git worktree remove --force "$tmp" 2>/dev/null || rm -rf "$tmp"' EXIT
git worktree add -q --detach "$tmp" "origin/$BRANCH"

cp status.json "$tmp/status.json"
git -C "$tmp" add status.json
git -C "$tmp" -c user.name="cctv-status" -c user.email="cctv-status@users.noreply.github.com" \
  commit -qm "status $(date -u +%FT%TZ)"

# The token stays in the environment; git only sees the helper's output.
git -C "$tmp" \
  -c credential.helper= \
  -c credential.helper='!f() { echo username=x-access-token; echo "password=$GITHUB_TOKEN"; }; f' \
  push -q "https://github.com/$REPO.git" "HEAD:$BRANCH"

echo "published status $(date -u +%FT%TZ)"
