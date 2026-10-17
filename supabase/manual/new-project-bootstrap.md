# New Supabase project bootstrap

Use this when the backend has to be rebuilt on a fresh Supabase project (the old
`vlqfgmrsprbrgzteixsj` project no longer exists).

## 1. Owner-only steps

1. Create a project at https://supabase.com/dashboard (Free plan, region Singapore `ap-southeast-1`).
   Save the database password in a password manager.
2. Create a personal access token at https://supabase.com/dashboard/account/tokens.
3. From Project Settings > API, note the project ref, the URL, the anon key and the service-role key.

## 2. Push schema, auth config and functions

```bash
export SUPABASE_ACCESS_TOKEN=<personal access token>
npx supabase link --project-ref <ref> -p '<db password>'
npx supabase db push                 # all migrations, including the deletion cron
npx supabase config push             # [auth] redirect allow-list from config.toml

openssl rand -hex 32                 # use as ACCOUNT_DELETION_WORKER_TOKEN
npx supabase secrets set ACCOUNT_DELETION_WORKER_TOKEN=<token> \
  GUEST_SESSION_API_KEY=<random> GUEST_SESSION_ALLOWED_ORIGINS=<origins> \
  INGEST_MENU_PHOTO_ALLOWED_ORIGINS=<origins> OPS_DISHES_DRAFT_ALLOWED_ORIGINS=<origins> \
  GOOGLE_CLOUD_VISION_API_KEY=<key>
npx supabase functions deploy process-account-deletions --no-verify-jwt
npx supabase functions deploy guest-sessions --no-verify-jwt
npx supabase functions deploy ingest-menu-photo
npx supabase functions deploy ops-dishes-draft
```

`config push` sets `site_url` and `additional_redirect_urls`
(`hungry://auth/callback`, `hungry://auth/confirm`). The dashboard path is
Authentication > URL Configuration if you prefer to set them by hand.

## 3. Turn on the deletion cron

The cron job (migration `20261017120000_account_deletion_worker_cron.sql`) runs every
15 minutes and does nothing until these Vault secrets exist. Run in the SQL editor:

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1/process-account-deletions', 'account_deletion_worker_url');
select vault.create_secret('<ACCOUNT_DELETION_WORKER_TOKEN>', 'account_deletion_worker_token');
```

Check it: `select * from cron.job_run_details order by start_time desc limit 5;` and
`select * from net._http_response order by created desc limit 5;` (expect HTTP 200).

## 4. Point the app and tools at the new project

- `.env.staging` / `.env.production` (and EAS env): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `.mcp.json` is account-scoped; append `?project_ref=<ref>` to pin it to one project.
- Scripts that call the Management API read `SUPABASE_PROJECT_REF`.

## 5. GitHub Actions (R01-CI-01)

Repository Settings > Secrets and variables > Actions:

| Kind     | Name                    | Value                 |
| -------- | ----------------------- | --------------------- |
| Secret   | `SUPABASE_ACCESS_TOKEN` | personal access token |
| Secret   | `SUPABASE_DB_PASSWORD`  | database password     |
| Variable | `SUPABASE_PROJECT_REF`  | project ref           |

The `Supabase migration dry run` step fails closed on `main` until all three exist.

## 6. R01-SUPA-01 smokes

```bash
export SUPABASE_DB_URL='postgresql://postgres.<ref>:<db password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
for f in supabase/smoke/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f" || echo "FAILED: $f"; done
SUPABASE_ACCESS_TOKEN=... npm run audit:supabase:advisor-security
```
