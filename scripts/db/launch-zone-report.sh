#!/usr/bin/env bash
# The launch zone scoreboard (build plan package 1.1): stalls, stalls with dishes, priced dishes,
# photos and hours for each place of the zone, and a total row. Read-only.
#   scripts/db/launch-zone-report.sh staging|prod
# Needs 20261116130000_launch_zone applied on that project. After the zone's rows reach production
# (package 1.7) run `select app_private.apply_launch_zone();` there once, or the report is empty.
# Environment: STAGING_DB_URL/STAGING_PGPASSWORD or PROD_DB_URL/PROD_PGPASSWORD, as the other
# scripts in this folder.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
[ $# -eq 1 ] || die "usage: launch-zone-report.sh staging|prod"
load_env "$1"
say "launch zone report ($ENV_NAME, $DB_REF)"
psql_db -c "select * from app_private.launch_zone_report()"
