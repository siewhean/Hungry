# Hungry Web V2

Next.js marketing site for Hungry, the Singapore dish-first food discovery app.

## Commands

```bash
npm run dev
npm run lint
npm run seo:audit
npm run build:webpack
```

## Public Routes

- `/`
- `/for-foodies`
- `/for-merchants`
- `/join-waitlist`
- `/privacy`
- `/terms`
- `/account/delete`

Route metadata is centralized in `src/app/seo.ts`. Keep sitemap routes, canonical metadata, and LLM context files aligned with that source.

## SEO And AI Discovery Surfaces

- `src/app/layout.tsx`: metadata base, default title template, Open Graph, Twitter, robots metadata, and global JSON-LD.
- `src/app/robots.ts`: public crawler policy for normal search crawlers and AI retrieval/training crawlers.
- `src/app/sitemap.ts`: generated XML sitemap from the canonical public route list.
- `src/components/seo/JsonLd.tsx`: JSON-LD script component.
- `public/llms.txt`: concise AI/LLM context map.
- `public/llms-full.txt`: expanded AI/LLM context and canonical wording.
- `scripts/seo-ai-readiness-check.mjs`: local guard for crawler files, structured data, AI crawler markers, and stale LLM routes.

## Environment

Set `NEXT_PUBLIC_SITE_URL` in production if the canonical domain changes. It defaults to `https://usehungry.com`.

Database-backed waitlist, Console, and Merchant Portal routes require the shared Hungry Supabase project:

- `NEXT_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, or the Expo public anon key equivalents
- `SUPABASE_SERVICE_ROLE_KEY` or `HUNGRY_SUPABASE_SERVICE_ROLE_KEY` for Console reads/admin writes and waitlist upserts
- `HUNGRY_CONSOLE_USERNAME` and `HUNGRY_CONSOLE_PASSWORD` for Console access. Store these as deployment secrets and local `.env.local` values only; never commit real credentials. Console pages and `/api/console/*` fail closed when either value is missing.
- Optional durable rate limiting uses an Upstash Redis REST-compatible store:
  - `HUNGRY_RATE_LIMIT_REDIS_REST_URL` / `HUNGRY_RATE_LIMIT_REDIS_REST_TOKEN`
  - or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
  - Without those values, route limits fall back to an in-memory process-local guard for local development only.
- Console prototype localStorage persistence is disabled in production unless `NEXT_PUBLIC_HUNGRY_CONSOLE_PROTOTYPE_STORAGE=1` is explicitly set. Production Console authority should come from server APIs, not browser-local state.

The public waitlist writes to `public.website_waitlist_entries`. Console summary and merchant verification APIs read/write the app merchant tables through the service role. The Merchant Portal uses Supabase Auth cookies and the same `merchant_accounts`, `merchant_outlets`, `merchant_verifications`, `dishes`, and review/analytics tables used by the mobile merchant surface, with the web shell linking to `hungry://merchant` for the app portal.

Merchant Portal mutation APIs use a double-submit CSRF guard. Login and session checks issue the readable `hungry_merchant_csrf_token` cookie, login rejects cross-site or non-JSON cookie-setting requests, and client-side merchant mutations send the matching `x-hungry-csrf-token` header through `merchantMutationFetch`. Server routes also reject mismatched cross-origin mutation requests unless explicitly allowed by `HUNGRY_MERCHANT_PORTAL_ORIGIN`.
