# Production Release Checklist

Date: 2026-06-07

## Repo-Local Gates

- [ ] `git diff --check`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm run test`
- [ ] `npm run scaling:validate`
- [ ] `npm run audit:assets`
- [ ] `npm run audit:supabase:static`
- [ ] `npm run check:edge-functions`
- [ ] `npm run release:ready:local`
- [ ] Expo Doctor using repo-compatible command

## Website Gates

- [ ] web-v2 typecheck
- [ ] web-v2 lint
- [ ] web-v2 build
- [ ] web-v2 sitemap validation
- [ ] web-v2 structured-data validation
- [ ] web-v2 route/security validation
- [ ] preview URL smoke

## Supabase Gates

- [ ] Migration dry run against staging
- [ ] Static RLS audit
- [ ] Live staging RLS smoke
- [ ] Advisor security review
- [ ] Edge Function static check
- [ ] Storage bucket policy check

## Mobile Gates

- [ ] iOS native smoke
- [ ] Android native smoke
- [ ] Auth persistence smoke
- [ ] Feed/search/detail smoke
- [ ] Post/review/favourite cross-account smoke
- [ ] Media upload smoke

## Merchant/Admin Gates

- [ ] Merchant owner/manager/member/non-member RBAC smoke
- [ ] Admin/non-admin console smoke
- [ ] CSRF mutation rejection smoke
- [ ] Audit-log evidence
- [ ] Merchant menu update propagation smoke

## External Gates

- [ ] Legal/privacy review
- [ ] App Store / Play Store metadata review
- [ ] Sentry/Vercel/Supabase alert proof
- [ ] Staging load-test evidence
- [ ] Rollback rehearsal
