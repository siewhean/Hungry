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

Active Supabase release: `68cd0682-1655-4ceb-bd53-043309c9aafb` (119,232 venues / 156,351 dishes).
Bundled Excel fallback release: `excel-fallback-v1` (4,273 venues / 22,042 dishes; SHA-256 prefix `a81ab6…e2262c3aef`).

These are exact cross-source Jurong East candidates, not passing Release 0.1 visual evidence. Live detail, menu, image and installed-artifact verification is blocked by the Supabase HTTP 402 quota restriction and missing internal-alpha artifacts. Records with unapproved, placeholder, restricted, or unverified media are deliberately withheld by the client media sanitizer.

### Dishes

| # | Dish ID | Name | Venue ID/name | Expected source(s) | Image/rights state | Price | Search term | Detail result |
|---:|---|---|---|---|---:|---:|---|---:|
| 1 | `dsh-c51ad71cb3753d53d08f32f313d834ab` | Meatless Minestrone | `ven-SFA-SW13S48L000` / The Soup Spoon | Supabase / Excel | Unverified; neutral fallback required | S$6.00 | meatless minestrone | Blocked live |
| 2 | `dsh-96649f14010a7770969311ac0ea7316e` | Mango Ice Blended | `ven-SFA-SW13T18X000` / The Coffee Bean & Tea Leaf | Supabase / Excel | Unverified; neutral fallback required | S$5.00 | mango ice blended | Blocked live |
| 3 | `01b9469c-51dc-4d1e-954d-9eaac7c49f5f` | Nasi Goreng Ayam | `ven-SFA-SW04164A000` / Al Barakath Restaurant | Supabase / Excel | Approved and permitted | S$8.50 | nasi goreng ayam | Blocked live |
| 4 | `0b79ab3c-58cf-48f5-909c-dc1d53f78a48` | Taro Tart | `ven-SFA-SW14083L000` / Time Table Cafe | Supabase / Excel | Approved and permitted | S$5.20 | taro tart | Blocked live |
| 5 | `dsh-menu-04263eb6fa832ad355b16c771c95c954` | Deep-Fried Calamari | `ven-SFA-C80172B009` / Banana Leaf Clementi BBQ Seafood | Supabase / Excel | Approved and permitted | S$16.00 | deep-fried calamari | Blocked live |
| 6 | `dsh-ven-sfa-sw13077p000-abalone-slice-63` | Abalone Slice | `ven-SFA-SW13077P000` / Sushi Express | Supabase / Excel | Unverified; neutral fallback required | S$4.50 | abalone slice | Blocked live |
| 7 | `dsh-47421e219b14dce0d1f0ec29e7de6410` | Pork Ribs Soup | `ven-SFA-SW13S03P000` / Song Fa Bak Kut Teh | Supabase / Excel | Unverified; neutral fallback required | S$6.00 | pork ribs soup | Blocked live |
| 8 | `dsh-dbd343a7ab4b48d232241b6a8cfc5d05` | Signature Herbal Roast Duck | `ven-SFA-SW13T26X000` / Dian Xiao Er | Supabase / Excel | Unverified; neutral fallback required | S$6.00 | herbal roast duck | Blocked live |
| 9 | `dsh-f5855af3386330577256db83a28dca2c` | Sotong Wing OnStik | `ven-SFA-SW13T76V000` / Old Chang Kee | Supabase / Excel | Unverified; neutral fallback required | S$6.00 | sotong wing | Blocked live |
| 10 | `dsh-e13b09db605294a482d21563e2a780a6` | Bento Sets | `ven-SFA-SW13205N000` / Greendot | Supabase / Excel | Unverified; neutral fallback required | S$6.00 | bento sets | Blocked live |

### Venues/stalls

| # | Venue ID | Name | Coordinates | Expected source(s) | Logo/stall/representative image status | Coordinates valid | Menu result | Detail result |
|---:|---|---|---|---|---|---:|---:|---:|
| 1 | `ven-SFA-SW13S48L000` | The Soup Spoon | `1.33320021671365, 103.743170430901` | Supabase / Excel | Unverified; withheld | Yes | Blocked live | Blocked live |
| 2 | `ven-SFA-SW13T18X000` | The Coffee Bean & Tea Leaf | `1.33320021671365, 103.743170430901` | Supabase / Excel | Unverified; withheld | Yes | Blocked live | Blocked live |
| 3 | `ven-SFA-SW04164A000` | Al Barakath Restaurant | `1.32136881443795, 103.742845116502` | Supabase / Excel | Approved/permitted | Yes | Blocked live | Blocked live |
| 4 | `ven-SFA-SW14083L000` | Time Table Cafe | `1.35067572550184, 103.720022400236` | Supabase / Excel | Approved/permitted | Yes | Blocked live | Blocked live |
| 5 | `ven-SFA-C80172B009` | Banana Leaf Clementi BBQ Seafood | `1.31353886546821, 103.765476312301` | Supabase / Excel | Approved/permitted | Yes | Blocked live | Blocked live |
| 6 | `ven-SFA-SW13077P000` | Sushi Express | `1.33402529468935, 103.74258601505` | Supabase / Excel | Unverified; withheld | Yes | Blocked live | Blocked live |
| 7 | `ven-SFA-SW13S03P000` | Song Fa Bak Kut Teh | `1.33320021671365, 103.743170430901` | Supabase / Excel | Unverified; withheld | Yes | Blocked live | Blocked live |
| 8 | `ven-SFA-SW13T26X000` | Dian Xiao Er | `1.33320021671365, 103.743170430901` | Supabase / Excel | Unverified; withheld | Yes | Blocked live | Blocked live |
| 9 | `ven-SFA-SW13T76V000` | Old Chang Kee | `1.33320021671365, 103.743170430901` | Supabase / Excel | Unverified; withheld | Yes | Blocked live | Blocked live |
| 10 | `ven-SFA-SW13205N000` | Greendot | `1.33402529468935, 103.74258601505` | Supabase / Excel | Unverified; withheld | Yes | Blocked live | Blocked live |

## Negative and failure cases

| Case | Input/setup | Expected |
|---|---|---|
| Legitimate no-results | `__release01_no_result_jurong_east__` with healthy Supabase | Empty state; no unrelated Excel result — blocked: staging credentials/base URL absent |
| Authenticated catalog outage | Valid restored session; intercept/disable catalog RPC only | Excel source badge and read-only results — blocked: staging credentials/base URL absent |
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
