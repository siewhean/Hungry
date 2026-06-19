# Website Performance QC Report

Date: 2026-06-18

## Repo-Local Findings

- Public SEO/legal/contact pages are static server-rendered routes.
- Private merchant/console pages are now proxy-gated and return explicit no-store/noindex headers.
- Existing image-heavy pages use local assets and Next/Image patterns in core public sections.
- Security and SEO validators are lightweight and CI-safe.
- Public Lighthouse was captured locally against the rebuilt production server on `http://localhost:3004`.
- Authenticated console Lighthouse was captured locally against `http://localhost:3005` with a temporary console token cookie.
- A cold homepage run scored lower on performance because of first-load LCP; a warmed rerun recovered above 90.
- Added `marketing/website/web-v2/scripts/lighthouse-qc.mjs` as repeatable `npm run perf:lighthouse` tooling. It runs public Lighthouse checks by default and can include authenticated merchant/console routes when token cookies are supplied.

## Local Lighthouse Results

| Route | Performance | Accessibility | Best Practices | SEO | LCP | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `/` cold | 79 | 94 | 96 | 100 | 5.3s | First cold run only. |
| `/` warmed rerun | 92 | 94 | 96 | 100 | 3.3s | Used as the current homepage local result. |
| `/for-foodies` | 90 | 95 | 96 | 100 | 3.6s | Public marketing page. |
| `/for-merchants` | 84 | 93 | 96 | 100 | 4.6s | Public marketing page; LCP should be watched before launch. |
| `/join-waitlist` | 94 | 95 | 96 | 100 | 3.1s | Public form page. |
| `/singapore` | 99 | 96 | 96 | 100 | 2.3s | Public SEO hub. |
| `/dishes/chicken-rice` | 99 | 96 | 96 | 100 | 2.3s | Public SEO dish page. |
| `/hawker-centres/maxwell-food-centre` | 99 | 96 | 96 | 100 | 2.3s | Public SEO place page. |
| `/merchant/login` | 95 | 94 | 100 | 66 | 2.9s | Auth page intentionally noindex; SEO score is not a deploy blocker. |
| `/merchant` unauthenticated | 93 | 94 | 100 | 66 | 3.2s | Redirects to login; authenticated dashboard proof still pending. |
| `/console` unauthenticated | 91 | 94 | 96 | 100 | 3.4s | Redirects home; authenticated console proof still pending. |
| `/console/waitlist` local token | 95 | 100 | 100 | 66 | 2.9s | Private page intentionally noindex; no console errors after a11y/prefetch fixes. |
| `/` via `npm run perf:lighthouse` | 90 | 94 | 96 | 100 | wrapper run | Repeatable wrapper proof on `http://127.0.0.1:3018`. |
| `/for-foodies` via `npm run perf:lighthouse` | 90 | 96 | 96 | 100 | wrapper run | Repeatable wrapper proof on `http://127.0.0.1:3018`. |
| `/for-merchants` via `npm run perf:lighthouse` | 98 | 94 | 96 | 100 | wrapper run | Repeatable wrapper proof on `http://127.0.0.1:3018`. |
| `/join-waitlist` via `npm run perf:lighthouse` | 94 | 95 | 96 | 100 | wrapper run | Repeatable wrapper proof on `http://127.0.0.1:3018`. |
| `/merchant/login` via `npm run perf:lighthouse` | 95 | 96 | 100 | 66 | wrapper run | Auth page intentionally noindex; SEO threshold lowered for private/auth routes. |

## Remaining Performance Blockers

- Authenticated merchant Lighthouse requires staging credentials.
- Authenticated console Lighthouse with a real Supabase admin/non-admin staging account remains pending; local token proof is complete.
- `marketing/website/web-v2 npm run build` passed on 2026-06-18 using the webpack builder.
- `marketing/web npm run build` passed on 2026-06-18.
- Public Lighthouse is repo-local only; production CDN/Vercel Lighthouse still needs to be captured after deployment preview is available.

## Required Lighthouse Pages

- [x] `/`
- [x] `/for-foodies`
- [x] `/for-merchants`
- [x] `/join-waitlist`
- [x] `/singapore`
- [x] `/dishes/chicken-rice`
- [x] `/hawker-centres/maxwell-food-centre`
- [x] `/merchant/login`
- [x] `/merchant` unauthenticated redirect only
- [x] `/console` unauthenticated redirect only
- [ ] Authenticated `/merchant`
- [x] Authenticated `/console/waitlist` local token proof
- [ ] Authenticated `/console` staging admin/non-admin proof
