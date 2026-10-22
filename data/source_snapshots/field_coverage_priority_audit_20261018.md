# Field Coverage Priority Audit — 2026-10-18

Read-only inspection of `data/Hungry F&B Database.Public Access 2026-10-17 Verified Menu Catalogue Refresh 40.xlsx`. Workbook SHA-256: `986a2656c3243d55c1a3914a3c5fbbdf2052e0423a69705785cbba0b7fee154e`. ZIP package is valid. No workbook edits, network requests, Mapbox result storage, delivery-platform scraping, or spend.

## Current coverage

| Field | Filled | Blank | Filled % |
|---|---:|---:|---:|
| F&B Name | 32,745 | 5,534 | 85.54% |
| Registered Business Name | 32,741 | 5,538 | 85.53% |
| Postal Code | 38,177 | 102 | 99.73% |
| Cuisine | 1,212 | 37,067 | 3.17% |
| Menu / Price | 460 | 37,819 | 1.20% |
| Opening Hours / Closed Days | 1,411 | 36,868 | 3.69% |
| Contact Details | 2,659 | 35,620 | 6.95% |
| Website | 2,735 | 35,544 | 7.14% |
| Menu URL | 1,385 | 36,894 | 3.62% |
| Rating / Review Count | 0 | 38,279 | 0.00% |
| Approved Image URL | 0 | 38,279 | 0.00% |

| Other measure | Current value |
|---|---:|
| Directory rows / unique SFA licences | 38,279 / 38,279 |
| Missing coordinate pairs | 2,545 |
| Coordinate gaps with postal / distinct postals | 2,443 / 1,558 |
| Public-access status: candidate / verified | 38,267 / 12 |
| Menu rows historical | 7,871 / 12,416 (63.39%) |
| Image candidates / approved directory images | 2,327 / 0 |
| Menu rows labeled Foodpanda source | 739 |

## Prioritized next batch

1. **Current official menus:** 96 distinct candidate brand/item keys are absent by normalized exact-match from the current menu sheet: 42 from the Four Leaves/Awfully Chocolate/Swee Heng/Heavenly Wang snapshot (45 rows, 3 duplicate keys), 34 Saizeriya/Sukiya rows, and 20 Sushiro/KOI rows. Another 33 Paris Baguette candidates are held because their source is under `/uat/` and production status is unverified. Preserve brand-level scope, source URLs, observed dates, and published prices only. Branch availability is not established.
2. **Image candidate:** one KOI Thé official full-menu artwork URL is absent from Image Candidates; it is not a dish-specific image or stall photo, and reuse rights are uncleared. Keep it review-only and unlinked to an outlet if appended.
3. **Registered names:** 1,852 exact licence+postal candidates remain blank in `Registered Business Name`; 1,850 are marked as the official SFA Eating Establishments source. The saved data was last verified 2026-04-04, so refresh it before using. Do not write these names into `F&B Name` without trading-name evidence.
4. **Public access:** 38,267 rows are still candidates inferred from SFA type/address; only 12 have operator-source verification. Continue exact record access checks; remove only confirmed non-public/catering or permanently closed records.
5. **Coordinates:** 2,443 of the 2,545 missing coordinate rows have postal codes (1,558 distinct). The existing BCA/HPB candidate snapshots add no new exact current points because their proposals are already populated. Use durable open data and label building/postal precision.
6. **Freshness:** 7,871 menu rows are explicitly historical; recheck first-party menus. Keep the 33 Munchi stale-price candidates and Paris Baguette `/uat/` source candidates held pending live production verification.
7. **Images and ratings:** 2,327 image URLs are review candidates; none is approved for directory display. Rights and outlet applicability remain unverified. The only net-new image URL found in the audited snapshots is the single KOI menu artwork candidate described above. Ratings/review counts are empty; the existing feasibility snapshot found no confirmed free source with appropriate persistent reuse.

## Conflicts and method limits

- The workbook has 38,279 unique SFA licence rows. SFA listing does not establish public access or current operation.
- 4,679 menu rows have no source URL. 739 are labeled as Foodpanda sourced; persistent reuse permission is not established. No delivery-platform scraping was done.
- 217 image candidates link to an SFA licence and 2,110 are brand-level/unlinked; 9 omit scope text. No image was promoted to `Approved Image URL`.
- Contact/website screens found zero high-confidence false values in the reviewed records. That screen does not confirm every saved phone, URL, or opening-hours value is currently live.
- Menu data is mixed-grain. One MOS Burger Teriyaki Chicken Burger source proposal at S$4.95 coexists with multiple workbook prices. Preserve source and outlet scope; do not flatten price variants.
- Menu candidate matching uses normalized exact brand+item names. Alias-only, different item naming, outlet stock, and current source changes still need review.

Source snapshot hashes and full count evidence are in [`field_coverage_priority_audit_20261018.json`](field_coverage_priority_audit_20261018.json).
