# Production-readiness worktree reconciliation — 2026-07-13

## Decision

`origin/main` at `8ed1d9c0b` is the integration target. No worktree is bulk-merged. Each source below was compared with `origin/main`, checked for dirtiness, and dry-run merge conflicts were reviewed first.

| Folder | Source state | Decision |
| --- | --- | --- |
| `Hungry-commit-ladder` | 16 commits ahead, 241 behind; tracked `.env.local`; broad conflicts | Retain. Do not merge secrets or old native/auth changes. |
| `Hungry-db-phase-0-1` | No unique commit; two dirty Discover files | Retain user WIP. Review as a separate scoped change. |
| `Hungry-isolation` | 2 commits ahead, 247 behind; 29 dirty paths and Expo patches | Retain. Do not merge obsolete Sprint 5/auth/Supabase changes. |
| `Hungry-main-reconcile` | Matches prior main; dirty backlog document only | Retain document WIP; no code to integrate. |
| `Hungry-mobile-audit-fixes` | One commit ahead but 54 behind; 73 conflicting files | Retain. Manually extract only still-missing fixes after current-source review. |
| `Hungry-production-readiness-audit` | Clean branch created from main | Integrated: readiness hardening, safe Excel sync, and reconciled workbook. |
| `Hungry-qc-readiness-bundle` | 5 commits ahead, 54 behind; workbook, env, and broad conflicts | Retain. Reconcile data through the canonical sync, never a Git binary merge. |
| `Hungry-qc-to-fdo` | No unique commit | No integration value. Retain until the owner removes it. |

## Integrated evidence

- The canonical workbook cache equals live Supabase: 119,232 venues and 156,010 dishes.
- Workbook validation: 25,304 valid rows, 0 invalid rows.
- Root source suite: 578 pass, 2 intentional skips.
- Do not delete any listed worktree without an owner-approved deletion manifest.
