#!/usr/bin/env bash
# Copy the content imported into the local D1 (`pnpm migrate:wp`) to the
# Cloudflare D1 in wrangler.jsonc.
#
# The remote schema comes from `pnpm deploy:database` (payload migrate); this
# copies data only, split to fit D1's 100 KB statement limit
# (scripts/export-d1.ts). Users that already exist remotely (e.g. the admin
# created on the live CMS) are kept; imported users arrive without passwords.
#
#   pnpm push:db            # export + import
#   pnpm push:db --dry-run  # export only
set -euo pipefail
cd "$(dirname "$0")/.."

DB=theinsightnews-cms
OUT=.migrate/cms-export.sql
mkdir -p .migrate

LOCAL=$(ls -S .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite | grep -v metadata | head -1)
sqlite3 "$LOCAL" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null

remote() { npx wrangler d1 execute "$DB" --remote --json --command "$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.stringify(JSON.parse(s)[0].results)))'; }

POSTS=$(remote "SELECT count(*) AS n FROM posts" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].n))')
if [[ "$POSTS" != "0" ]]; then
  echo "✗ remote $DB already has $POSTS posts — this is a one-time copy. Use 'pnpm migrate:wp --since=…' with PAYLOAD_REMOTE=1 for updates." >&2
  exit 1
fi
SKIP=$(remote "SELECT group_concat(id) AS ids FROM users" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].ids ?? ""))')

echo "→ exporting $LOCAL (keeping remote users: ${SKIP:-none})"
NODE_OPTIONS=--no-warnings npx tsx scripts/export-d1.ts "$LOCAL" "$OUT" --skip-user-ids="$SKIP"
ls -lh "$OUT"
if [[ "${1:-}" == "--dry-run" ]]; then exit 0; fi

echo "→ importing into remote D1 ($DB)"
npx wrangler d1 execute "$DB" --remote --file "$OUT" -y
npx wrangler d1 execute "$DB" --remote --command "PRAGMA optimize"
echo "✓ done"
