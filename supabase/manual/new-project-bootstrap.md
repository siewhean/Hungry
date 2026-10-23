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
npx supabase config push             # [auth] redirects, password policy, email templates

openssl rand -hex 32                 # use as ACCOUNT_DELETION_WORKER_TOKEN
npx supabase secrets set ACCOUNT_DELETION_WORKER_TOKEN=<token> \
  GUEST_SESSION_API_KEY=<random> GUEST_SESSION_ALLOWED_ORIGINS=<origins> \
  INGEST_MENU_PHOTO_ALLOWED_ORIGINS=<origins> OPS_DISHES_DRAFT_ALLOWED_ORIGINS=<origins> \
  GOOGLE_CLOUD_VISION_API_KEY=<key> \
  GEMINI_API_KEY=<key> TASTE_TAGGING_WORKER_TOKEN=<random> \
  AI_PROVIDER=<optional: gemini (default) or anthropic> AI_MODEL=<optional> ANTHROPIC_API_KEY=<only with anthropic> ANTHROPIC_WORKSPACE_ID=<only if the key has no workspace> \
  NOTIFICATION_WORKER_TOKEN=<random> EXPO_ACCESS_TOKEN=<optional> \
  MERCHANT_ALERTS_ENABLED=<"true" only once Merchant Centre is enabled in production>
npx supabase functions deploy process-account-deletions --no-verify-jwt
npx supabase functions deploy guest-sessions --no-verify-jwt
npx supabase functions deploy ingest-menu-photo
npx supabase functions deploy ops-dishes-draft
npx supabase functions deploy tag-dishes --no-verify-jwt
npx supabase functions deploy send-notifications --no-verify-jwt
```

`config push` sets `site_url` and `additional_redirect_urls`
(`hungry://auth/confirm`, `/reset`, `/oauth`, and the legacy `/callback`). The dashboard path is
Authentication > URL Configuration if you prefer to set them by hand.

It also sets the password policy (10+ characters, secure password change), the
Confirm signup, Reset password and Magic Link templates from `supabase/templates/`
(each shows the 8-digit `{{ .Token }}` code the app asks for). Production sends
auth email through the Send Email Hook (the `send-email` Edge Function on Resend,
domain `mail.usehungry.com`); set that hook in the dashboard and make sure its
emails include the code. Leaked-password protection has no config key: turn it on in
Authentication > Providers > Email > Prevent use of leaked passwords.

`config push` applies every auth key, and any key missing from `config.toml` is reset to the
CLI default. Check that the file pins every setting you care about before pushing, and answer
each prompt explicitly.

## 3. Turn on the cron jobs

The `process-account-deletions` cron (migration `20261017130000_account_deletion_worker_cron.sql`,
every 15 minutes) and the `send-notifications` cron (migration
`20261018003000_retention_follows_push_alerts.sql`) do nothing until their Vault secrets exist.
Run in the SQL editor:

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1/process-account-deletions', 'account_deletion_worker_url');
select vault.create_secret('<ACCOUNT_DELETION_WORKER_TOKEN>', 'account_deletion_worker_token');
select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-notifications', 'notification_worker_url');
select vault.create_secret('<NOTIFICATION_WORKER_TOKEN>', 'notification_worker_token');
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
