# Post-Launch Scaling Review

Date: 2026-06-07
Template owner: release lead

## Review Windows

- T+24 hours
- T+7 days
- T+30 days

## Metrics

| Area | Metrics |
| --- | --- |
| Mobile health | crash-free sessions, fatal errors, boot time, route transition p95 |
| Website health | 5xx, TTFB, build errors, crawler errors |
| Supabase | RPC p95/p99, RLS denies, Edge Function errors, storage errors |
| Discovery/search/detail | request volume, p95 latency, empty/error rates |
| Social writes | post/review/favourite/follow success rate |
| Merchant/admin | verification queue age, mutation failures, RBAC denies |
| Growth/SEO | impressions, crawl coverage, indexed pages, AI crawler hits |

## Review Questions

- Did any feature flag need to be rolled back?
- Which pages or RPCs are now hot paths?
- Are any queries missing indexes based on real telemetry?
- Did background work block user-critical paths?
- Did alerts trigger correctly and route to the right owner?
- Did any user-facing copy or schema overclaim live data?

## Output

- Summary
- Evidence links
- Incidents and near misses
- Top scaling bottlenecks
- Required follow-up PRs
- Decision: continue, slow rollout, or rollback
