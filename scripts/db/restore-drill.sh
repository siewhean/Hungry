#!/usr/bin/env bash
# Restore drill: prove a nightly copy restores and time it.
#   scripts/db/restore-drill.sh <encrypted .tar.age | unpacked backup folder> <scratch db url>
#   AGE_KEY_FILE=<path to your age private key>   needed when the first argument is a .tar.age
# The scratch database must be an empty Postgres with the same extensions (never staging or prod).
# Restores data.dump, recounts every table with scripts/db/sql/rowstats.sql and compares with the
# backup's rowstats.tsv. Prints the elapsed seconds and "drill ok" or exits 1 listing the differences.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
[ $# -eq 2 ] || die "usage: restore-drill.sh <file.tar.age|backup folder> <scratch db url>"
SRC="$1"; DB_URL="$2"
case "$(ref_of "$DB_URL")" in
  "$PROD_REF"|uuylnktiipkmcweyqnpd) die "the scratch database must not be staging or production" ;;
esac
command -v pg_restore >/dev/null || die "pg_restore not found"

WORK=""
trap '[ -z "$WORK" ] || rm -rf "$WORK"' EXIT
if [ -f "$SRC" ]; then
  [ -n "${AGE_KEY_FILE:-}" ] || die "set AGE_KEY_FILE to your age private key file"
  WORK="$(mktemp -d)"; chmod 700 "$WORK"
  age -d -i "$AGE_KEY_FILE" "$SRC" | tar -C "$WORK" -xf -
  DIR="$(echo "$WORK"/*)"
else
  DIR="$SRC"
fi
[ -s "$DIR/data.dump" ] && [ -s "$DIR/rowstats.tsv" ] || die "$DIR has no data.dump / rowstats.tsv"
(cd "$DIR" && grep -E ' (data.dump|rowstats.tsv|schema.sql|toc.txt)$' MANIFEST | while read -r sum f; do
  [ "$(sha256_of "$f")" = "$sum" ] || { echo "ERROR: checksum mismatch for $f" >&2; exit 1; }
done)

START=$(date +%s)
# Errors about objects that already exist (public schema, extensions) are expected; row counts decide.
pg_restore --clean --if-exists --no-owner -d "$DB_URL" "$DIR/data.dump" 2>"${TMPDIR:-/tmp}/restore-drill.err" || say "pg_restore reported warnings: $(wc -l <"${TMPDIR:-/tmp}/restore-drill.err" | tr -d ' ') lines in ${TMPDIR:-/tmp}/restore-drill.err"
ELAPSED=$(( $(date +%s) - START ))

DB_URL_SAVE="$DB_URL"
psql "$DB_URL_SAVE" -X -v ON_ERROR_STOP=1 -1 -At -F $'\t' -f "$DB_DIR/sql/rowstats.sql" -c "select tbl, n, h from pg_temp.hungry_rowstats(true) order by 1" >"${TMPDIR:-/tmp}/restore-drill.rowstats.tsv"
if diff <(sort "$DIR/rowstats.tsv") <(sort "${TMPDIR:-/tmp}/restore-drill.rowstats.tsv"); then
  say "restore took ${ELAPSED}s"
  say "drill ok: $(wc -l <"$DIR/rowstats.tsv" | tr -d ' ') tables match"
else
  die "row counts differ after restore (see diff above); restore took ${ELAPSED}s"
fi
