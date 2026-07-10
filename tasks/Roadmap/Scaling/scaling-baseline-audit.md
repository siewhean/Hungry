# Scaling Baseline Audit

Date: 2026-06-07
Branch: `frontend-design-overhaul`
Scope: repo-local scaling foundation only

## Scope Freeze

- No production Supabase migration was applied.
- No production deploy, Search Console action, Vercel action, or production load test was run.
- No new product feature was enabled.
- MVP production scope remains conservative: advanced/social/merchant/prototype surfaces stay gated unless separately approved.
- Active public website: `marketing/website/web-v2`.
- Legacy public website: `marketing/web`.

## Current Production Flag Posture

Source: `src/constants/featureFlags.ts`

| Surface | Production posture |
| --- | --- |
| Reads | Enabled |
| Crave / Daily Crave | Enabled |
| Merchant centre | Disabled through non-production surface gate |
| Direct messages | Disabled through non-production surface gate |
| Comments | Disabled through non-production surface gate |
| Stories | Disabled through non-production surface gate |
| Collections | Disabled through non-production surface gate |
| Gamification / Passport | Disabled through non-production surface gate |
| Prototype routes | Disabled in production |
| Floorplans | Disabled |
| OAuth provider buttons | Disabled through non-production surface gate |

## Backend Baseline

- Supabase remains canonical for shared and synced data.
- Zustand stores remain device-local cache, optimistic mirrors, or UI state.
- Migration files exist for MVP data, social safety, merchant organization, merchant analytics, website linkage, database Excel staging, and security remediation.
- Static smoke scripts exist for RLS, search, location, Edge Functions, assets, full-audit Supabase paths, and release readiness.
- Live Supabase smoke is not part of this pass without explicit credentials and owner approval.

## Website Baseline

- `marketing/website/web-v2` owns the launch website.
- SEO validation scripts exist for sitemap, structured data, route/security, and LLM context.
- Website scaling target: static/ISR pages where possible, no private route indexing, no fabricated rating/hour/review schema facts.

## Mobile Baseline

- Expo SDK 55 / React Native 0.83.6.
- Existing release gates cover typecheck, lint, format, source tests, assets, static Supabase audit, Edge Functions, TruffleHog, npm audit, and Expo Doctor.
- External native blockers remain Android/EAS proof and live device/staging mutation smoke.

## Scaling Classification

Status after this batch should be classified as:

`Conditional Go / repo-local scaling foundation complete`

The condition is external evidence: staging load smoke, production observability proof, Android/EAS proof, live Supabase Advisor/smoke evidence, and rollback rehearsal.
