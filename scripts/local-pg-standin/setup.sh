#!/usr/bin/env bash
# Build a fresh local PostgreSQL 16 that stands in for Supabase, then load the
# Supabase stand-ins (standin.sql). Run as root; the server runs as `postgres`.
#
#   scripts/local-pg-standin/setup.sh            # fresh cluster on port 5501
#   PORT=5502 BASE=/var/tmp/other scripts/local-pg-standin/setup.sh
#
# The cluster uses a private copy of the PG16 install under $BASE/install so
# that the extra extension files (real pgvector from the Ubuntu archive, stub
# pg_cron / pg_net from ./extensions) never touch the system install.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${BASE:-/var/tmp/hungry-standin}"
PORT="${PORT:-5501}"
PGV=16
INSTALL="$BASE/install"
BIN="$INSTALL/lib/postgresql/$PGV/bin"
SHARE="$INSTALL/share/postgresql/$PGV"
DATA="$BASE/data"
SOCK="$BASE/sock"

if [ ! -x "$BIN/postgres" ]; then
  mkdir -p "$INSTALL/lib/postgresql" "$INSTALL/share/postgresql" "$BASE/dl"
  cp -a "/usr/lib/postgresql/$PGV" "$INSTALL/lib/postgresql/"
  cp -a "/usr/share/postgresql/$PGV" "$INSTALL/share/postgresql/"
fi

if [ ! -f "$SHARE/extension/vector.control" ]; then
  deb="$(ls "$BASE"/dl/postgresql-$PGV-pgvector_*.deb 2>/dev/null | head -1 || true)"
  if [ -z "$deb" ]; then
    (cd "$BASE/dl" && apt-get download "postgresql-$PGV-pgvector")
    deb="$(ls "$BASE"/dl/postgresql-$PGV-pgvector_*.deb | head -1)"
  fi
  rm -rf "$BASE/dl/x"
  dpkg -x "$deb" "$BASE/dl/x"
  cp "$BASE"/dl/x/usr/share/postgresql/$PGV/extension/vector* "$SHARE/extension/"
  cp "$BASE"/dl/x/usr/lib/postgresql/$PGV/lib/vector.so "$INSTALL/lib/postgresql/$PGV/lib/"
fi
cp "$HERE"/extensions/* "$SHARE/extension/"

# Fresh cluster.
if [ -f "$DATA/postmaster.pid" ]; then
  su postgres -s /bin/bash -c "'$BIN/pg_ctl' -D '$DATA' -m fast stop" || true
fi
rm -rf "$DATA" "$SOCK"
mkdir -p "$DATA" "$SOCK"
chown -R postgres:postgres "$BASE"
su postgres -s /bin/bash -c "'$BIN/initdb' -D '$DATA' -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null"
su postgres -s /bin/bash -c "'$BIN/pg_ctl' -D '$DATA' -l '$BASE/server.log' -w \
  -o \"-p $PORT -k $SOCK -c listen_addresses='' -c wal_level=logical -c fsync=off -c synchronous_commit=off -c full_page_writes=off\" start >/dev/null"

psql -X -q -h "$SOCK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$HERE/standin.sql"
echo "stand-in ready: psql -h $SOCK -p $PORT -U postgres -d postgres"
