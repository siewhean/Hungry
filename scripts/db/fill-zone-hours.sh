#!/usr/bin/env bash
# Opening hours for the launch zone (build plan package 1.3): reads each zone stall's hours text,
# turns the clear lines into a structured weekly schedule (venues.opening_schedule) and leaves the
# rest as they are ("Hours not confirmed" in the app). Data only: no migration.
#   scripts/db/fill-zone-hours.sh staging|prod            dry run: counts and the lines it would skip
#   scripts/db/fill-zone-hours.sh staging|prod --apply    write the schedules (one transaction)
#   scripts/db/fill-zone-hours.sh staging|prod --undo FILE  clear the schedules a run wrote (FILE is its undo list);
#                                                           one a merchant has edited since is left alone
# Only stalls with no schedule yet are touched, in one UPDATE ... WHERE opening_schedule IS NULL, so a
# schedule a merchant or the hours-board photo set is never overwritten, and a rerun does nothing twice.
# Scope: the stalls of the zone's places (public.launch_zone_places, package 1.1). Add --all-venues to
# ignore the zone (staging before 20261116130000 is applied there). Needs node and the repo's tsx.
# Environment: STAGING_DB_URL/STAGING_PGPASSWORD or PROD_DB_URL/PROD_PGPASSWORD, as scripts/db/*.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/common.sh"

[ $# -ge 1 ] || die "usage: fill-zone-hours.sh staging|prod [--apply | --undo FILE] [--all-venues]"
TARGET="$1"; shift
APPLY=0; UNDO=""; ALL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --all-venues) ALL=1 ;;
    --undo) shift; UNDO="${1:-}"; [ -n "$UNDO" ] || die "--undo needs the undo list file" ;;
    *) die "unknown option '$1'" ;;
  esac
  shift
done
load_env "$TARGET"
command -v node >/dev/null || die "node not found"
say "zone hours ($ENV_NAME, $DB_REF)"

if [ -n "$UNDO" ]; then
  [ -f "$UNDO" ] || die "no such file: $UNDO"
  node -e '
    const list = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const ok = Array.isArray(list) && list.every((r) => r && /^[0-9a-f-]{36}$/.test(r.id) && r.schedule && typeof r.schedule === "object");
    process.exit(ok ? 0 : 1);
  ' "$UNDO" || die "$UNDO is not a list of {id, schedule} written by --apply"
  # Only a schedule still equal to the one this run wrote is cleared: a merchant's later edit stays.
  psql_db -Atq -v undo="$(cat "$UNDO")" <<'SQL'
begin;
with cleared as (
  update public.venues v set opening_schedule = null
    from jsonb_to_recordset(:'undo'::jsonb) as d(id uuid, schedule jsonb)
   where v.id = d.id and v.opening_schedule = d.schedule
  returning v.id)
select 'schedules cleared: ' || count(*) from cleared;
commit;
SQL
  say "done (schedules changed since the run were left alone)"
  exit 0
fi

if [ "$ALL" -eq 1 ]; then SCOPE="true"; else
  SCOPE="v.building_id in (select lp.building_id from public.launch_zone_places lp)"
fi
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
psql_db -At -c "select coalesce(json_agg(json_build_object('id', v.id, 'name', v.name, 'operating_hours', v.operating_hours)), '[]'::json)
  from public.venues v where v.opening_schedule is null and $SCOPE" > "$WORK/rows.json"
(cd "$REPO_ROOT" && node --import tsx scripts/hours/zone-hours-plan.ts "$WORK/rows.json") > "$WORK/plan.json"
node -e '
  const plan = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  console.log(JSON.stringify(plan.counts));
  for (const s of plan.skipped.filter((x) => x.reason === "unclear")) console.log("skipped (unclear):", s.name, "|", s.hours);
' "$WORK/plan.json"

if [ "$APPLY" -ne 1 ]; then say "dry run: nothing written. Add --apply to write the schedules."; exit 0; fi

mkdir -p "$BACKUP_ROOT"
UNDO_FILE="$BACKUP_ROOT/zone-hours-$ENV_NAME-$(date -u +%Y%m%dT%H%M%SZ)-$$.json"
[ ! -e "$UNDO_FILE" ] || die "$UNDO_FILE already exists"
node -e 'const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(JSON.stringify(p.updates));' "$WORK/plan.json" > "$WORK/updates.json"
# The plan goes down first, so an undo file exists even if the write is cut off; it is replaced by
# the rows the UPDATE really changed once it returns.
cp "$WORK/updates.json" "$UNDO_FILE"
psql_db -Atq -v updates="$(cat "$WORK/updates.json")" > "$WORK/applied.json" <<'SQL'
begin;
with changed as (
  update public.venues v set opening_schedule = d.schedule
    from jsonb_to_recordset(:'updates'::jsonb) as d(id uuid, schedule jsonb)
   where v.id = d.id and v.opening_schedule is null
  returning v.id, v.opening_schedule as schedule)
select coalesce(json_agg(json_build_object('id', id, 'schedule', schedule)), '[]'::json) from changed;
commit;
SQL
# Replace the plan with what was really written, in one rename so a cut-off never leaves half a file.
cp "$WORK/applied.json" "$UNDO_FILE.tmp"
node -e 'const a = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (!Array.isArray(a)) process.exit(1);' "$UNDO_FILE.tmp" \
  || die "could not finalise $UNDO_FILE (the plan in it is still a valid undo list)"
mv "$UNDO_FILE.tmp" "$UNDO_FILE"
say "schedules written: $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).length)' "$WORK/applied.json")"
say "undo list written to $UNDO_FILE. Undo with: scripts/db/fill-zone-hours.sh $ENV_NAME --undo $UNDO_FILE"
