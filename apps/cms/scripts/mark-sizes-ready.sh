#!/usr/bin/env bash
# Set media.sizes_ready = 1 for the images whose resized copies the backfill
# (`migrate:wp --steps=sizes`) has written, on the remote D1 and the local one.
# Until then the website shows those images' originals. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."
DONE=.migrate/sizes-done.txt
OUT=.migrate/mark-sizes-ready.sql
[[ -s "$DONE" ]] || { echo "nothing in $DONE"; exit 0; }
sort -un "$DONE" | awk 'BEGIN{ORS=""} {ids[NR]=$1} END{for(i=1;i<=NR;i+=500){print "UPDATE media SET sizes_ready = 1 WHERE id IN ("; for(j=i;j<i+500&&j<=NR;j++){print (j>i?",":"") ids[j]} print ");\n"}}' > "$OUT"
echo "→ $(sort -un "$DONE" | wc -l | tr -d ' ') images"
npx wrangler d1 execute theinsightnews-cms --remote --file "$OUT" -y | grep -E '"changes"' || true
LOCAL=$(ls -S .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite 2>/dev/null | grep -v metadata | head -1 || true)
[[ -n "$LOCAL" ]] && sqlite3 "$LOCAL" < "$OUT" && rm -f "$LOCAL-shm" "$LOCAL-wal"
echo "✓ done"
