# Website Final Deploy Checklist

Date: 2026-06-18

## P0 Gates

- [x] Root `npm run typecheck`
- [x] Root `npm run lint`
- [x] Root `npm run format:check`
- [x] Root `npm run test`
- [x] Root `npm run security:audit`
- [x] Root `npm run test:e2e`
- [x] Root `npm run test:e2e:merchant-catalog`
- [x] `marketing/website/web-v2 npm run lint`
- [x] `marketing/website/web-v2 npm run security:audit`
- [x] `marketing/website/web-v2 npm run private-routes:qc` — unauthenticated private denial proof; authenticated branches token-gated.
- [x] `marketing/website/web-v2 npm run seo:validate`
- [x] `marketing/website/web-v2 npm run seo:sitemap`
- [x] `marketing/website/web-v2 npm run seo:structured-data`
- [x] `marketing/website/web-v2 npm run seo:links`
- [x] `marketing/website/web-v2 npm run legal:validate`
- [x] `marketing/website/web-v2 npm run env:validate` — local skip plus synthetic proof-mode pass.
- [x] `marketing/website/web-v2 npm run predeploy:local` — static predeploy bundle passed; runtime/browser/build gates remain opt-in and conditional.
- [x] Root `npm run website:predeploy:local` — passes and is wired into CI plus `release:ready`.
- [x] `marketing/website/web-v2 npm run routes:inventory` — audit inventory covers every current page/API route.
- [x] `marketing/website/web-v2 npm run perf:lighthouse` — default public/auth matrix passed locally.
- [x] `marketing/website/web-v2 npm run build`
- [x] `marketing/web npm run lint`
- [x] `marketing/web npm run build` — passed outside sandbox after sandboxed Turbopack port-bind panic.
- [x] Browser QC for public routes
- [x] Lighthouse public routes
- [x] Repeatable Lighthouse QC wrapper for public and token-authenticated private routes
- [x] Unauthenticated merchant/console private route no-store/noindex header proof
- [x] Unauthenticated merchant/console private route QC against local production server
- [x] Local token-authenticated console route/API/Lighthouse proof
- [x] Console prototype storage and seed-data fallbacks fail closed in production
- [x] Console overview does not render sample claims, alerts, traffic charts, or fabricated KPI/SLA values in production fallback mode
- [x] Console notifications does not render sample campaigns or pretend to send local-only notifications in production fallback mode
- [x] Console product analytics does not render prototype growth/funnel/release/flag dashboards in production fallback mode
- [x] Console Users empty production fallback avoids fake source labels, `NaN%`, and local-only trust mutations
- [x] Merchant verification fallback does not render named demo stall identity or fake ACRA/Corppass claims as production-live behavior
- [x] Service-role env names are source-scanned and restricted to server-only Supabase code
- [x] Merchant menu/profile/verification mutations write server-side merchant audit logs
- [x] Waitlist API enforces JSON content-type and merchant required fields server-side
- [ ] Authenticated merchant QC
- [ ] Authenticated console staging admin/non-admin QC
- [ ] Lighthouse authenticated merchant route
- [x] Skip-link static and rendered smoke across public/auth/private layout targets
- [x] Merchant/console modal and drawer dialog semantics contract
- [x] Automated keyboard smoke across public and merchant auth pages plus unauthenticated private redirects
- [x] Local token-authenticated console keyboard smoke
- [x] Authenticated merchant keyboard smoke is wired and fail-closed when `HUNGRY_MERCHANT_ACCESS_TOKEN` is absent
- [x] Authenticated merchant/console route/API QC is wired and fail-closed when required tokens are absent
- [ ] Manual screen-reader smoke and staging merchant/console private keyboard pass
- [x] Rendered-page broken-link crawl for public pages
- [x] Deployment env proof contract is wired and fail-closed for staging/production.
- [ ] Production/staging console secret and admin-auth configuration proof from owner-controlled env.
- [x] Legal/privacy technical consistency contract
- [ ] Legal/privacy final sign-off by owner/legal reviewer

## External Launch Proof

- [ ] Search Console submission proof
- [ ] Bing submission proof
- [ ] Rich Results validation against the deployed URL

## Deploy Decision

Current decision: **No-Go for production deploy** until the unchecked P0 gates above are completed or explicitly waived with owner approval.

## 2026-06-19 Vercel Deployment Evidence

- [x] Vercel project linked: `siewheans-projects/hungry-web-v2` (`prj_MVmdMlCMMNX4fI3YMY8dJPQWuCJq`)
- [ ] Production envs set for site URL, Supabase public/service-role access, PostHog public config, Sentry auth token, merchant origin, deployment env, and `HUNGRY_CONSOLE_USERNAME` / `HUNGRY_CONSOLE_PASSWORD`.
- [x] Production deploy succeeded: `dpl_tqJsCyKY6ktgbhHCVZXzVzf4pipJ`
- [x] Live Vercel URL: `https://hungry-web-v2.vercel.app`
- [x] Runtime smoke: homepage `200` with security headers.
- [x] Runtime smoke: `/console` redirects to `/` with `no-store`/`noindex`.
- [x] Runtime smoke: `/merchant` redirects to `/merchant/login?returnTo=%2Fmerchant` with `no-store`/`noindex`.
- [x] Runtime smoke: `/robots.txt` and `/sitemap.xml` return `200`.
- [x] `usehungry.com` and `www.usehungry.com` added to the Vercel project.
- [ ] DNS configured at registrar: set `A usehungry.com 76.76.21.21` and `A www.usehungry.com 76.76.21.21`, or switch nameservers to `ns1.vercel-dns.com` / `ns2.vercel-dns.com`.
- [ ] Custom-domain smoke: `curl -I https://usehungry.com` currently times out until DNS is configured/propagated.
- [ ] Sentry website DSN/project proof: only `SENTRY_AUTH_TOKEN` was available during deploy setup; crash capture is not proven for web-v2.
