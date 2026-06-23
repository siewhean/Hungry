# App Prefetch QC Report

Updated: 2026-06-21  
Status: **Repo-local contracts exist; native performance proof pending.**

## Requirements

| Check | Expected behavior |
|---|---|
| image prefetch | uses `expo-image` and deduplicates |
| dish/stall/post prefetch | warms data and images without blocking navigation |
| route preload | calls navigation preload only when available |
| failure handling | no crash, no visible error |
| authorization | merchant/admin prefetch cannot expose unauthorized data |
| production flags | disabled routes are not prefetched |
| performance | capped idle work per tick |

## Evidence

- `src/app/performance-prefetch-contracts.test.ts`
- `src/features/navigation/prefetch.ts`

## Remaining Proof

- Low-end Android memory/network observation.
- Native tap-latency smoke after app is installed.

