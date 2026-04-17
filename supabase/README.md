# Supabase Runbook

This folder contains migration, seed, and Edge Function artifacts for Sprint 5 + Phase 7 backend bootstrap.

## Files

- `migrations/0001_extensions.sql` — required extensions (`postgis`, `vector`, `pg_trgm`, `btree_gist`, `citext`, `uuid-ossp`).
- `migrations/0002_core_schema.sql` — baseline app schema (buildings, venues, dishes, reviews, profile, social).
- `migrations/0003_rls_policies.sql` — baseline RLS for existing tables.
- `migrations/0004_profile_avatar.sql` — profile avatar URL column.
- `migrations/0005_seed_dietary_flags.sql` — canonical dietary flags seed.
- `migrations/0006_seed_venue_categories.sql` — venue category seed + link table.
- `migrations/0007_update_dish_rating_trigger.sql` — review aggregate trigger for dish rating/count.
- `migrations/0008_phase7_auth_scaffold.sql` — guest sessions, orders, chat messages, auth/RLS scaffolding.
- `migrations/0009_blog_sources.sql` — normalized blog source catalog.
- `seed.sql` — generated seed from mock fixtures (`npm run seed:generate`).
- `functions/guest-sessions/index.ts` — `POST /functions/v1/guest-sessions` endpoint scaffold.
- `smoke/postgis_distance.sql` — prepared PostGIS distance smoke query.
- `smoke/pgvector_similarity.sql` — prepared pgvector cosine/HNSW smoke query.

## Commands

```bash
# 1) Generate seed from current mock fixtures
npm run seed:generate

# 2) Start local Supabase stack
supabase start

# 3) Apply migrations + seed locally
supabase db reset --local --include-seed

# 4) Serve guest-session function locally
supabase functions serve guest-sessions --env-file .env.local

# 5) Deploy migrations + function to linked project
supabase db push
supabase functions deploy guest-sessions --no-verify-jwt

# 6) Optional smoke checks against linked DB (via direct Postgres URL)
psql "$SUPABASE_DB_URL" -f supabase/smoke/postgis_distance.sql
psql "$SUPABASE_DB_URL" -f supabase/smoke/pgvector_similarity.sql
```

Required function environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GUEST_SESSION_API_KEY` (required header: `x-guest-session-key`)
- `GUEST_SESSION_ALLOWED_ORIGINS` (comma-separated exact origins, for example `https://hungry.app,https://staging.hungry.app`)

## Guest Session API (scaffold)

`POST /functions/v1/guest-sessions`

Request JSON:

```json
{
  "deviceId": "ios:abc123",
  "ttlHours": 24,
  "metadata": { "entryPoint": "qr_order" }
}
```

Response JSON:

```json
{
  "guestSessionId": "uuid",
  "token": "opaque-token",
  "expiresAt": "2026-04-18T16:00:00.000Z"
}
```

Headers:

- `x-guest-session-key: <GUEST_SESSION_API_KEY>`
- Browser origin must be allow-listed by `GUEST_SESSION_ALLOWED_ORIGINS`.
- Origin-less native/mobile requests are accepted when API key is valid.
- `deviceId` is required and used for per-device rate limiting (20 session mints/hour).

## Notes

- The function stores only a SHA-256 hash of the guest token in `guest_sessions.token_hash`.
- Dashboard-level provider setup (email/password, Google, Apple) is still required externally in Supabase Auth settings.
- PostGIS/pgvector smoke scripts are committed in `supabase/smoke/`; execution still requires a live linked Supabase DB.
- `seed.sql` is non-destructive and idempotent (UPSERT/ON CONFLICT). Use `supabase db reset --local --include-seed` for local reset flows only.
