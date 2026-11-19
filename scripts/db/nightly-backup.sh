#!/usr/bin/env bash
# Nightly production copy, run by .github/workflows/nightly-backup.yml (also fine to run by hand).
#   BACKUP_DB_URL            postgresql://backup_ro.<ref>:<password>@<session pooler host>:5432/postgres
#                            (a read-only login, see supabase/manual/nightly-backup.md)
#   BACKUP_AGE_PUBLIC_KEY    age public key (age1...). Only the owner holds the private key.
#   NIGHTLY_OUT_DIR          where the encrypted file is written (default: ./nightly-out)
# Takes the same dump as scripts/db/backup.sh prod, refuses a partial one, packs it into one tar,
# encrypts it with age and deletes every plain-text file. Prints the encrypted file path last.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

[ -n "${BACKUP_DB_URL:-}" ] || die "BACKUP_DB_URL is not set"
[ -n "${BACKUP_AGE_PUBLIC_KEY:-}" ] || die "BACKUP_AGE_PUBLIC_KEY is not set"
[[ "$BACKUP_AGE_PUBLIC_KEY" =~ ^age1[a-z0-9]+$ ]] || die "BACKUP_AGE_PUBLIC_KEY must be an age public key starting with age1 (never the AGE-SECRET-KEY private key)"
command -v age >/dev/null || die "age not found (apt-get install age)"

OUT_DIR="${NIGHTLY_OUT_DIR:-./nightly-out}"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Split "user:password@" out of the URL so backup.sh sees a password-free URL, as it expects.
if [[ "$BACKUP_DB_URL" =~ ^([a-z]+://[^:/@]+):([^@]+)@(.*)$ ]]; then
  export PROD_DB_URL="${BASH_REMATCH[1]}@${BASH_REMATCH[3]}"
  export PROD_PGPASSWORD="${BASH_REMATCH[2]}"
else
  export PROD_DB_URL="$BACKUP_DB_URL"
fi
export HUNGRY_BACKUP_DIR="$WORK"

DIR="$("$DB_DIR/backup.sh" prod nightly | tail -1)"
[ -d "$DIR" ] || die "backup.sh did not produce a folder"

# A login that cannot read a table reports n = -1 in rowstats: that would be a partial copy.
if awk -F'\t' '$2 == -1 { bad = 1; print "unreadable table: " $1 > "/dev/stderr" } END { exit bad ? 0 : 1 }' "$DIR/rowstats.tsv"; then
  die "backup login cannot read every table; fix its grants (supabase/manual/nightly-backup.md)"
fi
[ "$(wc -l <"$DIR/rowstats.tsv")" -ge 10 ] || die "rowstats lists fewer than 10 tables; refusing to keep this copy"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ENC="$OUT_DIR/prod-${STAMP}.tar.age"
tar -C "$WORK" -cf - "$(basename "$DIR")" | age -r "$BACKUP_AGE_PUBLIC_KEY" -o "$ENC"
head -c 22 "$ENC" | grep -q '^age-encryption.org' || die "encrypted file does not look like an age file"
rm -rf "$DIR"

say "encrypted copy: $(du -h "$ENC" | cut -f1) ($(ref_of "$PROD_DB_URL"))"
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "file=$ENC" >>"$GITHUB_OUTPUT"; fi
echo "$ENC"
