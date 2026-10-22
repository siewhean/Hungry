#!/usr/bin/env bash
# Ship one rehearsed migration to PRODUCTION.
#   scripts/db/ship.sh <14-digit migration version>
# Refuses unless: the repo safety check passes, the rehearsal evidence matches the files byte for
# byte and is under 14 days old, the files are on origin/main, and prod has not applied it yet.
# Then: backup prod -> apply (single transaction, rolls back if any table loses rows) -> smokes.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
[ $# -eq 1 ] || die "usage: ship.sh <migration version>"
load_env prod
resolve_migration "$1"
check_pg_dump_version
cd "$REPO_ROOT"

say "repo safety check"
node scripts/check-migration-safety.mjs || die "fix the problems above first"
EVIDENCE="supabase/rehearsals/${VERSION}.json"
if sql_header_has "$UP" "no-rehearsal"; then
  echo "WARNING: $MIG_NAME carries a '-- no-rehearsal' waiver. Continue only if sh approved it."
else
  [ -f "$EVIDENCE" ] || die "no rehearsal evidence at $EVIDENCE"
  node -e '
    const e = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const age = (Date.now() - Date.parse(e.rehearsed_at)) / 86400000;
    if (!(age <= 14)) { console.error("Rehearsal is " + Math.round(age) + " days old. Re-run scripts/db/rehearse.sh."); process.exit(1); }
  ' "$EVIDENCE" || exit 1
fi

say "checking the files are on origin/main"
git fetch -q origin main
for f in "$UP" ${DOWN:+"$DOWN"} $([ -f "$EVIDENCE" ] && echo "$EVIDENCE"); do
  rel="${f#$REPO_ROOT/}"
  git cat-file -e "origin/main:$rel" 2>/dev/null || die "$rel is not on origin/main yet. Merge the PR first."
  git diff --quiet "origin/main" -- "$rel" || die "$rel differs from origin/main. Check out the merged version."
done

MISSING="$(missing_older_migrations "$VERSION")"
if [ -n "$MISSING" ] && [ -z "${ALLOW_LEDGER_GAP:-}" ]; then
  die "prod's migration ledger is missing older migrations:$MISSING. Check them; set ALLOW_LEDGER_GAP=1 only if they are known to be applied."
fi
if ledger_has "$VERSION"; then die "$VERSION is already applied on prod."; fi

CONFIRM="${CONFIRM_SHIP:-}"
if [ -z "$CONFIRM" ]; then
  [ -t 0 ] || die "not interactive: set CONFIRM_SHIP=$VERSION"
  read -r -p "Type $VERSION to ship $MIG_NAME to PRODUCTION ($DB_REF): " CONFIRM
fi
[ "$CONFIRM" = "$VERSION" ] || die "confirmation did not match"

say "backing up prod"
BACKUP_DIR="$("$DB_DIR/backup.sh" prod "pre-$VERSION" | tail -1)"
say "applying $MIG_NAME"
apply_guarded "$UP" insert || die "migration failed and was rolled back; prod is unchanged. Backup: $BACKUP_DIR"
say "smokes"
if ! run_smokes "$UP"; then
  echo "A smoke failed AFTER the migration committed." >&2
  [ -z "$DOWN" ] || echo "Undo with: scripts/db/rollback.sh prod $VERSION" >&2
  echo "Backup: $BACKUP_DIR" >&2
  exit 1
fi
echo
say "SHIPPED $MIG_NAME to prod ($DB_REF). Backup: $BACKUP_DIR"
[ -z "$DOWN" ] || echo "To undo: scripts/db/rollback.sh prod $VERSION"
