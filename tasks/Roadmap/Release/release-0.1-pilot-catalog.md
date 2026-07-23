# Hungry Release 0.1 — Jurong East Pilot Catalog

Updated: 2026-07-24  
Pilot area: Jurong East  
Reference coordinate: `1.3331, 103.7421`  
Radius: `3,500 m`

## Automated minimum thresholds

| Metric | Minimum |
|---|---:|
| Pilot venues | 10 |
| Pilot dishes | 20 |
| Image-backed venues | 5 |
| Image-backed dishes | 10 |
| Valid coordinate coverage | 95% |
| Blocked placeholder image URLs | 0 |

Source contracts:

```text
src/constants/release01.ts
scripts/audit-release-01-catalog.mjs
src/lib/services/catalog/release01Pilot.test.ts
```

## Catalog-wide food-intent probes

The current automated probes are useful search-intent smoke tests, but they are not sufficient pilot evidence by themselves:

- chicken rice;
- laksa;
- nasi lemak;
- char kway teow;
- roti prata;
- fish soup;
- wanton mee;
- yong tau foo;
- bak kut teh;
- curry puff.

Codex must preserve them and add exact Jurong East record cases.

## Exact pilot manifest

Fill this table using stable IDs from the final staging release and bundled Excel catalog. Do not invent missing facts.

### Dishes

| # | Dish ID | Name | Venue ID/name | Expected source(s) | Image expected | Price expected | Search term | Detail pass |
|---:|---|---|---|---|---:|---:|---|---:|
| 1 |  |  |  | Supabase/Excel |  |  |  |  |
| 2 |  |  |  | Supabase/Excel |  |  |  |  |
| 3 |  |  |  | Supabase/Excel |  |  |  |  |
| 4 |  |  |  | Supabase/Excel |  |  |  |  |
| 5 |  |  |  | Supabase/Excel |  |  |  |  |
| 6 |  |  |  | Supabase/Excel |  |  |  |  |
| 7 |  |  |  | Supabase/Excel |  |  |  |  |
| 8 |  |  |  | Supabase/Excel |  |  |  |  |
| 9 |  |  |  | Supabase/Excel |  |  |  |  |
| 10 |  |  |  | Supabase/Excel |  |  |  |  |

### Venues/stalls

| # | Venue ID | Name | Building/area | Expected source(s) | Logo/stall/representative image | Coordinates valid | Menu pass | Detail pass |
|---:|---|---|---|---|---|---:|---:|---:|
| 1 |  |  |  | Supabase/Excel |  |  |  |  |
| 2 |  |  |  | Supabase/Excel |  |  |  |  |
| 3 |  |  |  | Supabase/Excel |  |  |  |  |
| 4 |  |  |  | Supabase/Excel |  |  |  |  |
| 5 |  |  |  | Supabase/Excel |  |  |  |  |
| 6 |  |  |  | Supabase/Excel |  |  |  |  |
| 7 |  |  |  | Supabase/Excel |  |  |  |  |
| 8 |  |  |  | Supabase/Excel |  |  |  |  |
| 9 |  |  |  | Supabase/Excel |  |  |  |  |
| 10 |  |  |  | Supabase/Excel |  |  |  |  |

## Negative and failure cases

| Case | Input/setup | Expected |
|---|---|---|
| Legitimate no-results | Deliberately nonexistent dish/stall string with healthy Supabase | Empty state; no unrelated Excel result |
| Authenticated catalog outage | Valid restored session; intercept/disable catalog RPC only | Excel source badge and read-only results |
| Signed-out outage | Sign out, then remove network/catalog | Auth only; no Excel access |
| Invalid/revoked session | Revoke token/session | Account state cleared; auth only |
| Missing released config | Remove required public Supabase config in production-like build | Blocking configuration state |
| Bad image URL | Record with unreachable or blocked URL | Neutral unavailable/fallback image; no layout failure |
| Duplicate pagination | Load three pages | No repeated stable IDs except deliberately duplicated source data that is explicitly quarantined |

## Image policy

Dish image priority:

1. approved menu/gallery image;
2. approved primary dish image;
3. neutral image-unavailable state.

Venue image priority:

1. stall logo;
2. stall/venue image;
3. representative menu dish image;
4. neutral unavailable state.

Reject at the shared catalog mapping boundary:

- Unsplash;
- Picsum;
- generic placeholder domains;
- generic social-hero images;
- unapproved or rights-unknown media where the release contract requires approval.

## Completion evidence

Attach or link:

- exact audit JSON from `scripts/audit-release-01-catalog.mjs`;
- Supabase catalog release ID and totals;
- Excel source checksum and totals;
- screenshots of at least five dishes and five venues;
- three-page pagination ID lists for both sources;
- no-results screenshot;
- authenticated fallback screenshot;
- failed-image fallback screenshot;
- current commit SHA and build ID.

The pilot catalog is complete only when every exact manifest row passes on the final Release 0.1 commit.