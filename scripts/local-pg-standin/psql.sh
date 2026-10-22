#!/usr/bin/env bash
# psql into the stand-in cluster: scripts/local-pg-standin/psql.sh [psql args]
BASE="${BASE:-/var/tmp/hungry-standin}"
PORT="${PORT:-5501}"
exec psql -X -h "$BASE/sock" -p "$PORT" -U postgres -d "${PGDATABASE:-hungry}" "$@"
