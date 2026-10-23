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
- `migrations/0016_mobile_storage_security.sql` — mobile media buckets, storage policies, and hardened menu-photo RPC.
- `migrations/0018_merchant_centre_verification_schema.sql` — merchant account, outlet, role, and verification foundations.
- `migrations/0019_merchant_consumer_linkage.sql` through `0022_merchant_catalog_column_guards.sql` — merchant writes linked to consumer venue/dish/review rows with RLS and column guards.
- `migrations/0023_integration_posts_privacy_chat.sql` — integration readiness schema for privacy, posts, post media, participant chat, read receipts, realtime publication, and merchant/post media buckets.
- `seed.sql` — generated seed from mock fixtures (`npm run seed:generate`).
- `functions/guest-sessions/index.ts` — `POST /functions/v1/guest-sessions` endpoint scaffold.
- `functions/ingest-menu-photo/index.ts` — authenticated OCR ingestion for menu-photo submissions.
- `functions/ops-dishes-draft/index.ts` — ops-only dish draft review endpoint.
- `smoke/postgis_distance.sql` — prepared PostGIS distance smoke query.
- `smoke/pgvector_similarity.sql` — prepared pgvector cosine/HNSW smoke query.
- `smoke/mobile_storage_policies.sql` — mobile bucket/policy smoke checks.
- `smoke/merchant_rls_policies.sql` — merchant RLS and catalog guard smoke checks.
- `smoke/integration_readiness.sql` — post/privacy/chat/storage/realtime readiness smoke checks.

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
supabase functions deploy ingest-menu-photo
supabase functions deploy ops-dishes-draft

# 6) Optional smoke checks against linked DB (via direct Postgres URL)
psql "$SUPABASE_DB_URL" -f supabase/smoke/postgis_distance.sql
psql "$SUPABASE_DB_URL" -f supabase/smoke/pgvector_similarity.sql
psql "$SUPABASE_DB_URL" -f supabase/smoke/mobile_storage_policies.sql
psql "$SUPABASE_DB_URL" -f supabase/smoke/merchant_rls_policies.sql
psql "$SUPABASE_DB_URL" -f supabase/smoke/integration_readiness.sql
```

Required function environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `GUEST_SESSION_API_KEY` (required header: `x-guest-session-key`)
- `GUEST_SESSION_ALLOWED_ORIGINS` (comma-separated exact origins, for example `https://hungry.app,https://staging.hungry.app`)
- `INGEST_MENU_PHOTO_ALLOWED_ORIGINS` (comma-separated exact origins; origin-less native requests are accepted after JWT validation)
- `GOOGLE_CLOUD_VISION_API_KEY`
- `GEMINI_API_KEY` (optional; falls back to deterministic OCR parsing when absent)
- `AI_PROVIDER` / `AI_MODEL` (optional; pick the model for `mood-search` and `tag-dishes`: `gemini` with `GEMINI_API_KEY` (default model `gemini-3.8-flash`) or `anthropic` with `ANTHROPIC_API_KEY` (default `claude-haiku-5-5`))
- `OPS_DISHES_DRAFT_ALLOWED_ORIGINS` (comma-separated exact trusted ops origins; native no-origin requests still require JWT)
- `SUPABASE_ANON_KEY` (used to validate caller JWT before service-role operations)

Ops draft review access now requires an authenticated Supabase user present in `app_ops_admins`; static `x-ops-api-key` authorization is no longer supported.

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

## Rate limits

REST (PostgREST): `pgrst.db_pre_request` runs `app_private.check_request_rate()` before every request
(migration `20261022120000_api_request_rate_limits.sql`). It counts POST/PATCH/PUT/DELETE per minute by
signed-in user id, or by client IP for anon, and answers HTTP 429 over the cap. Caps live in
`app_private.request_rate_rules` (`route` is `rpc/<function>` or `<table>`; `*` is the shared default for
every route without a row). `service_role` is never limited, GET on `/rpc/*` is refused (a read-only
transaction cannot write the counter), and a counter error fails open.

- New anon-callable RPC: insert a rule row with an anon cap in a new migration, or list it in
  `rate-limit-allowlist.json` with a reason. A limited RPC must be `VOLATILE` (`alter function ... volatile`):
  PostgREST runs POST on a STABLE or IMMUTABLE function in a READ ONLY transaction, where the counter cannot
  be written, so the limit would silently never apply (found on prod; migration 20261022130000). CI checks this.
- New table or signed-in RPC that can be abused in a loop: add a rule row with a `user_per_minute` cap.
- New Edge Function: call `app_can_make_ip_request(ip, action, limit)` before auth and
  `app_can_make_user_request(user, action, limit)` after it, guard it with a worker token, or list it in
  `rate-limit-allowlist.json` with a reason.
- Auth endpoints: `[auth.rate_limit]` in `config.toml`.
- `npm run check:rate-limits` (CI) fails when an anon RPC or Edge Function is neither limited nor listed.
- Not covered: GET reads of tables anon can select, and raw Edge Function invocation counts (needs a
  Cloudflare/WAF rule in front of the project).
- Roll back: `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`.

## Notes

- The function stores only a SHA-256 hash of the guest token in `guest_sessions.token_hash`.
- Dashboard-level provider setup (email/password, Google, Apple) is still required externally in Supabase Auth settings.
- PostGIS/pgvector smoke scripts are committed in `supabase/smoke/`; execution still requires a live linked Supabase DB.
- `seed.sql` is non-destructive and idempotent (UPSERT/ON CONFLICT). Use `supabase db reset --local --include-seed` for local reset flows only.
