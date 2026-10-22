#!/usr/bin/env bash
# Undo an applied migration with its down file.
#   scripts/db/rollback.sh staging|prod <14-digit migration version>
# Backs up first, runs the down file in one transaction (rolls back if any table loses rows it did
# not declare), and removes the version from the migration ledger. Afterwards also revert the
# migration in git (or ship a forward fix) so the repo and the database agree again.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
[ $# -eq 2 ] || die "usage: rollback.sh staging|prod <migration version>"
load_env "$1"
resolve_migration "$2"
check_pg_dump_version
[ -n "$DOWN" ] || die "no down migration at supabase/rollbacks/${MIG_NAME}.down.sql"
ledger_has "$VERSION" || die "$VERSION is not applied on $ENV_NAME"

if [ "$ENV_NAME" = prod ]; then
  CONFIRM="${CONFIRM_ROLLBACK:-}"
  if [ -z "$CONFIRM" ]; then
    [ -t 0 ] || die "not interactive: set CONFIRM_ROLLBACK=$VERSION"
    read -r -p "Type $VERSION to ROLL BACK $MIG_NAME on PRODUCTION ($DB_REF): " CONFIRM
  fi
  [ "$CONFIRM" = "$VERSION" ] || die "confirmation did not match"
fi

say "backing up $ENV_NAME"
BACKUP_DIR="$("$DB_DIR/backup.sh" "$ENV_NAME" "pre-rollback-$VERSION" | tail -1)"
say "applying down"
apply_guarded "$DOWN" delete || die "rollback failed and was rolled back. $ENV_NAME is unchanged. Backup: $BACKUP_DIR"
say "ROLLED BACK $MIG_NAME on $ENV_NAME. Backup: $BACKUP_DIR"
echo "Now revert the migration in git (or add a forward fix) so the repo matches the database."
