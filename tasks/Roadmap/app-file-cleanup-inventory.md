# App File Cleanup Inventory

Updated: 2026-06-21  
Scope: `frontend-design-overhaul` prelaunch review for App Store and Google Play.

## Inventory Summary

Tracked files inspected by path ownership: 1,515.

| Area | Count | Category | Production relevance | Risk | Action |
|---|---:|---|---|---|---|
| `src/` | 548 | mobile app source | primary app bundle | stale dev/prototype imports, route exposure, store-policy risk | keep, gate advanced routes, test |
| `marketing/` | 373 | public website and legacy web | store support/privacy URLs, ASO landing pages | public URL accuracy and private route indexing | keep, validate separately |
| `supabase/` | 119 | backend migrations/functions/smoke | canonical shared data, RLS, deletion jobs | live proof missing | keep, smoke before release |
| `tasks/` | 106 | release evidence/docs | audit trail | stale docs can misstate readiness | keep current reports, archive stale only |
| `scripts/` | 80 | CI, data, smoke, release gates | prelaunch verification | destructive/live scripts need owner approval | keep, require env gates |
| `data/` | 50 | source data/import assets | discovery/search staging | data quality and import proof | keep, validate/import with approval |
| `ios/` | 21 | native iOS project | App Store build artifact | generated plist can contain dev-only entries | use release-safe Expo config |
| `.maestro/` | 10 | native smoke flows | device QA | simulator/device proof pending | keep and run before release |
| `tests/` | 16 | Playwright e2e | web/app regression | incomplete native coverage | keep, expand as needed |
| `assets/` | 9 | app icons/logos | store listing/build | provenance and sizing | keep, audit |

## Cleanup Decisions

| Path pattern | Decision | Rationale |
|---|---|---|
| `src/app/screens/dev/**` | gate | Developer launcher/design gallery must not be production-openable. |
| `src/app/screens/merchant/**` | gate/human review | Full platform launch requires merchant RBAC and native smoke proof. |
| `src/app/screens/home/*Chat*`, story screens | gate | DMs/stories require UGC safety and moderation proof. |
| `src/components/gamification/**`, passport assets | gate | Gamification stays disabled unless launch-approved and tested. |
| `src/lib/services/supabase/**` | keep | Canonical shared data path; static and live RLS smoke required. |
| `src/store/**` | keep | Store state must remain cache/optimistic/device-local where appropriate. |
| `marketing/website/web-v2/**` | keep | Active public website and store support URL surface. |
| `marketing/web/**` | keep as legacy | Build-check only unless redeployed. |
| `.maestro/.watchman-cookie-*`, repo `.watchman-cookie-*`, `.DS_Store` | delete when touched by cleanup PR | Generated local junk, never release evidence. |
| `data/**` | human review | Do not delete source data without import/provenance confirmation. |
| `output/`, `scratch/`, `graphify-out/` | human review | Generated artifacts may support audits; delete only after reference scan. |

## Current No-Delete Rule

No unique app/runtime file should be deleted in this pass. Only exact local junk and proven unreferenced generated files are safe to remove after `rg` import/reference checks and `npm run audit:assets`.

