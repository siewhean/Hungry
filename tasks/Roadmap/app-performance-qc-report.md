# Hungry App Performance QC Report

Updated: 2026-06-19
Verdict: **Partial**. Source-level performance patterns exist; device/runtime metrics are still required.

## Targets

| Area | Target | Current proof |
|---|---:|---|
| Cold start to usable | under 3s on modern device | pending measured proof |
| Tab switch | under 300ms perceived | pending measured proof |
| Search response | under 500ms p95 staging | pending staging metrics |
| Detail load | under 300ms p95 staging | pending staging metrics |
| Feed first page | under 700ms p95 staging | pending staging metrics |
| Image upload failure | under 2 percent staging smoke | pending staging smoke |
| Crash-free sessions | 99 percent plus before public launch | pending Sentry proof |
| 30 minute session | no crash/memory leak | pending runtime smoke |

## Source Evidence

| Area | Evidence | Status |
|---|---|---|
| Discovery/filter responsiveness | performance-prefetch contracts and Discover source | source coverage present |
| Detail hydration | detail hydration contracts | source coverage present |
| Feed refresh | preserve-ready refresh pattern in Home feed | source coverage present |
| Media picker | prepared native media smoke contract | source coverage present |
| Asset bundle | `npm run audit:assets` | pending rerun for this pass |
| Load scripts | `scripts/load/*` and `npm run scaling:validate` | scaffold exists; real load proof pending |

## Required Runtime Proof

- iOS current-device smoke with cold/warm start notes.
- Android low-end or emulator smoke.
- Staging Supabase search/detail timing sample.
- Feed scroll and repeated detail navigation session.
- Media upload success/failure smoke.
- Sentry performance/crash monitoring proof.
