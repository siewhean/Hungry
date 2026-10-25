# Hungry Website — Production-Readiness Audit

**Date:** 2026-06-19
**Audited:** `marketing/website/web-v2` (Next.js 15 / App Router)
**Scope:** Public marketing, SEO, merchant portal, admin console, API routes, legal pages, accessibility, security, performance tooling

---

## Audit Summary

All P0 blockers resolved. All static predeploy gates pass.

| Gate | Status |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| ESLint (`npm run lint`) | ✅ 0 warnings |
| Route inventory (63 routes) | ✅ Pass |
| Security route contracts | ✅ Pass |
| SEO/AI readiness | ✅ Pass |
| Sitemap validation | ✅ Pass |
| Structured data validation | ✅ Pass |
| Legal readiness | ✅ Pass |
| Accessibility contracts | ✅ Pass |

---

## Fixes Implemented

### 1. SEO — Console & Merchant noindex (HIGH)

**Problem:** `/console` and `/merchant` layouts are `"use client"` and cannot export `metadata`. They inherited the root layout's `robots: { index: true }`. A direct backlink bypassing `robots.txt` would let Google index admin/merchant portal pages.

**Fix:** Split each client layout into two files:
- `ConsoleClientLayout.tsx` / `MerchantClientLayout.tsx` — the interactive client shell (unchanged behaviour)
- `layout.tsx` — new **server component** that exports `metadata: { robots: { index: false, follow: false } }` and renders the client layout

**Files changed:**
- `src/app/console/layout.tsx` (server wrapper)
- `src/app/console/ConsoleClientLayout.tsx` (new)
- `src/app/merchant/layout.tsx` (server wrapper)
- `src/app/merchant/MerchantClientLayout.tsx` (new)

---

### 2. SEO — Remove hardcoded root canonical (MEDIUM)

**Problem:** `layout.tsx` set `alternates: { canonical: "/" }` globally. This leaked onto console, merchant, and 404 pages.

**Fix:** Removed. All public pages set their own canonical via `routeMetadata()`.

---

### 3. SEO — Wire noindex quality gates to content routes (MEDIUM)

**Problem:** `src/lib/seo/noindex.ts` quality-gate functions were never called. Thin/sparse content pages were indexed unconditionally.

**Fix:** Applied `hasIndexable*` gates to every `seoContentRoutes` entry. Pages that don't meet the data threshold get `noindex: true` and are excluded from the sitemap.

---

### 4. Security — Sanitize x-forwarded-for in rate limiter (HIGH)

**Problem:** `clientRequestKey()` used the raw `x-forwarded-for` value. A crafted value could escape its rate-limit bucket.

**Fix:** Added `sanitizeIp()` with `SAFE_IP_RE = /^[0-9a-fA-F:.]{2,45}$/`. Falls back to `"unknown"` on malformed input.

---

### 5. Security — Rate limits on authenticated GET routes (MEDIUM)

**Problem:** Console summary, console waitlist, console merchants, merchant session, and merchant overview GET routes had no rate limiting.

**Fix:** Added `requireRateLimit()` to all five routes (60–120 req/min).

---

### 6. Security — UUID validation on outletId path param (LOW)

**Problem:** `console/merchants/[outletId]/verification` passed `outletId` to service-role Supabase queries without format validation.

**Fix:** Added UUID regex check before touching Supabase. Returns 400 on invalid input.

---

### 7. Accessibility — Waitlist success state missing h1 (MEDIUM)

**Problem:** Success view after form submission had no `<h1>`. Screen readers had no page heading.

**Fix:** Added `<h1>You are on the list</h1>` to the success state.

---

### 8. Legal — Waitlist form missing Privacy Policy link (HIGH)

**Problem:** The waitlist form collected personal data with no link to the Privacy Policy — a PDPA disclosure gap.

**Fix:** Added "Privacy Policy" link after the disclosure text at the bottom of the form.

---

### 9. Accessibility — About page duplicate generic h3 labels (MEDIUM)

**Problem:** Pain-point articles each had `<h3>Pain</h3>` and `<h3>Hungry resolution</h3>` — 6 identical headings in the outline.

**Fix:** Replaced with `<h3 className="sr-only">Pain point {i + 1}</h3>` (unique, visually hidden). Added `.sr-only` utility to `globals.css`.

---

### 10. TypeScript — Pre-existing TS error (LOW)

**Problem:** `api/waitlist/route.ts` had `TS18048: possibly 'undefined'` on `establishmentType.toLowerCase()`.

**Fix:** Changed to `establishmentType?.toLowerCase()`.

---

## Verified Pass — No Changes Needed

| Area | Verdict |
|---|---|
| `robots.ts` disallows `/api/`, `/console/`, `/merchant/` | ✅ Correct |
| Supabase service role key — not exported, not in responses | ✅ Correct |
| No stack traces in any API error response | ✅ Correct |
| Merchant CSRF — double-submit cookie pattern | ✅ Correct |
| All public pages call `routeMetadata()` for canonical/OG/Twitter | ✅ Correct |
| Privacy policy — real PDPA-aligned content | ✅ Real |
| Terms of service — real content | ✅ Real |
| Waitlist API — rate limited + input validated | ✅ Correct |
| No lorem ipsum or fake testimonials | ✅ Clean |
| `html lang="en-SG"` | ✅ Correct |
| Skip link + `#main-content` target | ✅ Present |
| `:focus-visible` global styles | ✅ Present |
| `prefers-reduced-motion` | ✅ Handled |
| Hydration-unsafe patterns in public pages | ✅ None |
| JSON-LD structured data | ✅ Present |
| Security headers (CSP, HSTS, X-Frame-Options) | ✅ Present |

---

## Route Inventory

| Route | Type | Public/private | Auth required | Indexed? | Data source | Risk | Fix |
|---|---|---|---:|---:|---|---|---|
| `/.well-known/apple-app-site-association` | App link config | Public | No | No | Static JSON | Low | iOS Universal Links for share paths |
| `/.well-known/assetlinks.json` | App link config | Public | No | No | ANDROID_APP_SIGNING_SHA256 env | Low | Android App Links; empty list until the env is set |
| `/` | Public marketing | Public | No | Yes | Static content + safe public SEO data | Low | Keep public and cached |
| `/about` | Public marketing | Public | No | Yes | Static content | Low | Keep public and cached |
| `/account/delete` | Public legal | Public | No | Yes | Static legal/support copy | Low | Keep support route visible |
| `/contact` | Public support | Public | No | Yes | Static contact CTAs | Low | Keep no sensitive storage |
| `/dish/[id]` | Public share preview | Public | No | No (noindex) | Supabase anon REST (RLS) | Medium | Shared app links; no private data |
| `/dishes/[dishSlug]` | Public SEO | Public | No | Conditional | Supabase/public fallback content | Medium | Noindex if thin or unsupported facts |
| `/for-foodies` | Public marketing | Public | No | Yes | Static content | Low | Keep public and cached |
| `/for-merchants` | Public marketing | Public | No | Yes | Static content | Low | Keep public and cached |
| `/guides/[guideSlug]` | Public SEO | Public | No | Conditional | Static guide content | Medium | Noindex thin guides |
| `/home` | App link fallback | Public | No | No | None (redirects to `/`) | Low | Weekly picks push opens the app; web visitors go home |
| `/hawker-centres/[centreSlug]` | Public SEO | Public | No | Conditional | Supabase/public fallback content | Medium | Noindex if thin or unsupported facts |
| `/join-waitlist` | Public form | Public | No | Yes | Static form + `/api/waitlist` | Medium | Validate client and API payloads |
| `/malls/[mallSlug]/food` | Public SEO | Public | No | Conditional | Supabase/public fallback content | Medium | Noindex if thin or unsupported facts |
| `/portfolio/[id]` | Public share preview | Public | No | No (noindex) | get_public_portfolio RPC (public lists only) | Medium | Uncached so private lists disappear at once |
| `/post/[id]` | Public share preview | Public | No | No (noindex) | None (opens the app) | Low | Fallback for shared post links without the app |
| `/user/[id]` | Public share preview | Public | No | No (noindex) | public_profiles (RLS: public accounts only) | Low | Uncached so a profile made private disappears at once |
| `/privacy` | Public legal | Public | No | Yes | Legal copy | Medium | Keep provider claims accurate |
| `/singapore` | Public SEO | Public | No | Yes | Static Singapore index | Low | Keep public and cached |
| `/singapore/[area]/[dish]` | Public SEO | Public | No | Conditional | Supabase/public fallback content | Medium | No fake ratings/hours |
| `/singapore/[area]/food` | Public SEO | Public | No | Conditional | Supabase/public fallback content | Medium | Noindex if thin |
| `/singapore/mrt/[station]/food` | Public SEO | Public | No | Conditional | Supabase/public fallback content | Medium | Noindex if thin |
| `/review/[id]` | Public share preview | Public | No | No (noindex) | Supabase anon REST (RLS) | Low | Shared review links; shows only the public review text and dish |
| `/stall/[id]` | Public share preview | Public | No | No (noindex) | Supabase anon REST (RLS) | Medium | Shared app links; no private data |
| `/stalls/[stallSlug]` | Public SEO | Public | No | Conditional | Supabase/public fallback content | Medium | No fake verification |
| `/terms` | Public legal | Public | No | Yes | Legal copy | Medium | Keep legal copy reviewed |
| `/merchant` | Merchant private | Private | Yes | No | Merchant API/session | High | Server middleware block + noindex headers |
| `/merchant/ai-assistant` | Merchant private | Private | Yes | No | Merchant shell/API | High | Server middleware block + noindex headers |
| `/merchant/analytics` | Merchant private | Private | Yes | No | Merchant shell/API | High | Server middleware block + noindex headers |
| `/merchant/forgot-password` | Merchant auth | Public | No | No | Auth form/API | Medium | Public auth route, noindex |
| `/merchant/login` | Merchant auth | Public | No | No | Auth form/API | Medium | Public auth route, noindex |
| `/merchant/menu` | Merchant private | Private | Yes | No | Merchant API/session | High | Server middleware block + noindex headers |
| `/merchant/menu/ocr-drafts` | Merchant private | Private | Yes | No | Merchant shell/API | High | Server middleware block + noindex headers |
| `/merchant/profile` | Merchant private | Private | Yes | No | Merchant API/session | High | Server middleware block + noindex headers |
| `/merchant/promotions` | Merchant private | Private | Yes | No | Merchant shell/API | High | Server middleware block + noindex headers |
| `/merchant/reviews` | Merchant private | Private | Yes | No | Merchant shell/API | High | Server middleware block + noindex headers |
| `/merchant/settings` | Merchant private | Private | Yes | No | Merchant shell/API | High | Server middleware block + noindex headers |
| `/merchant/signup` | Merchant auth | Public | No | No | Auth form/API | Medium | Public auth route, noindex |
| `/merchant/verification` | Merchant private | Private | Yes | No | Merchant API/session | High | Server middleware block + noindex headers |
| `/console` | Admin private | Private | Yes | No | Console API/session | High | Server middleware block + noindex headers |
| `/console/[section]` | Admin private | Private | Yes | No | Console shell/API | High | Server middleware block + noindex headers |
| `/console/audit-log` | Admin private | Private | Yes | No | Console shell/API | High | Server middleware block + noindex headers |
| `/console/feature-flags` | Admin private | Private | Yes | No | Console shell/API | High | Server middleware block + noindex headers |
| `/console/feedback` | Admin private | Private | Yes | No | Console shell/API | High | Server middleware block + noindex headers |
| `/console/merchant-applications` | Admin private | Private | Yes | No | Console API/session | High | Server middleware block + noindex headers |
| `/console/merchants` | Admin private | Private | Yes | No | Console API/session | High | Server middleware block + noindex headers |
| `/console/notifications` | Admin private | Private | Yes | No | Console shell/API | High | Server middleware block + noindex headers |
| `/console/product-analytics` | Admin private | Private | Yes | No | Console shell/API | High | Server middleware block + noindex headers |
| `/console/product-analytics/[section]` | Admin private | Private | Yes | No | Console shell/API | High | Server middleware block + noindex headers |
| `/console/reports` | Admin private | Private | Yes | No | Console shell/API | High | Server middleware block + noindex headers |
| `/console/users` | Admin private | Private | Yes | No | Console API/session | High | Server middleware block + noindex headers |
| `/console/waitlist` | Admin private | Private | Yes | No | Console API/session | High | Server middleware block + noindex headers |
| `/api/waitlist` | API public | Public | No | No | Supabase service route | High | JSON-only validation + rate limit |
| `/api/merchant/forgot-password` | API public auth | Public | No | No | Merchant auth service | Medium | Validate payload + rate limit |
| `/api/merchant/login` | API public auth | Public | No | No | Merchant auth service | High | Validate payload + rate limit |
| `/api/merchant/logout` | API private | Private | Yes | No | Merchant session | Medium | Require session |
| `/api/merchant/menu` | API private | Private | Yes | No | Supabase merchant data | High | Auth + CSRF + outlet scope + audit log |
| `/api/merchant/menu/[dishId]` | API private | Private | Yes | No | Supabase merchant data | High | Auth + CSRF + outlet scope + audit log |
| `/api/merchant/overview` | API private | Private | Yes | No | Supabase merchant data | High | Auth + rate limit |
| `/api/merchant/profile` | API private | Private | Yes | No | Supabase merchant data | High | Auth + CSRF + outlet scope + audit log |
| `/api/merchant/session` | API private | Private | Yes | No | Merchant session | Medium | Auth + rate limit |
| `/api/merchant/signup` | API public auth | Public | No | No | Merchant auth service | High | Validate payload + rate limit |
| `/api/merchant/verification` | API private | Private | Yes | No | Supabase merchant data | High | Auth + CSRF + audit log |
| `/api/console/dataset` | API private | Private | Yes | No | Supabase console datasets | High | Admin auth + rate limit + redaction |
| `/api/console/me` | API private | Private | Yes | No | Console session identity | Medium | Admin auth + role-safe response |
| `/api/console/merchants` | API private | Private | Yes | No | Supabase console data | High | Admin auth + redaction |
| `/api/console/merchants/[outletId]/verification` | API private | Private | Yes | No | Supabase console mutation | High | Admin auth + UUID validation + audit log |
| `/api/console/summary` | API private | Private | Yes | No | Supabase console data | High | Admin auth + redaction |
| `/api/console/team` | API private | Private | Yes | No | Console admin membership | High | Admin role + CSRF + JSON validation + rate limit |
| `/api/console/team/[memberId]` | API private | Private | Yes | No | Console admin membership mutation | High | Admin role + CSRF + validation + rate limit |
| `/api/console/waitlist` | API private | Private | Yes | No | Supabase waitlist data | High | Admin auth + redaction |

---

## Remaining Open Items (Not blocking pre-deploy)

| # | Priority | Item |
|---|---|---|
| 1 | Medium | Terms of Service: add governing law (Singapore) and limitation of liability clause |
| 2 | Medium | Privacy Policy: add cross-border data transfer notice (Supabase servers may be outside SG) |
| 3 | Medium | Account deletion: add self-serve web form for users without app access |
| 4 | Low | Console CSRF: upgrade static sentinel string to a random token (matching merchant CSRF pattern) |
| 5 | Low | Redis rate limiter: add startup warning if Redis env vars are absent in production |
| 6 | Low | `schema.ts`: add `@id` IRI to `buildLocalBusinessSchema`; add `datePublished` to `buildArticleSchema` |
| 7 | Info | Footer `<h4>` headings have no `<h3>` ancestor — consider downgrading to `<p>` with heading styling |
| 8 | Info | Food images in phone mockup use `alt=""` — defensible given parent aria-label, but should be documented |

---

## Audit Method

- Static: `tsc --noEmit`, `eslint`, all `scripts/*.mjs` predeploy gates
- Manual: Full read of every API route, all layout files, all public pages, all legal pages, all SEO config
- Subagent parallel research: API security audit, SEO/robots/sitemap, legal/forms, page structure/accessibility
- Not run (requires live server): Lighthouse, rendered link checks, keyboard smoke, private-route runtime QC

### Consumer policy routes added 25 October 2026

| Route | Surface | Evidence |
| --- | --- | --- |
| `/refund` | Public policy/notice | `marketing/website/web-v2/src/app/refund/page.tsx` |
| `/cookies` | Public policy/notice | `marketing/website/web-v2/src/app/cookies/page.tsx` |
| `/business` | Public policy/notice | `marketing/website/web-v2/src/app/business/page.tsx` |
| `/credits` | Public policy/notice | `marketing/website/web-v2/src/app/credits/page.tsx` |
