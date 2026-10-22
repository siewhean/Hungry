# Singapore F&B rating source feasibility audit — 2026-10-18

- Canonical workbook checked: `Hungry F&B Database.Public Access 2026-10-17 Verified Menu Catalogue Refresh 40.xlsx`
- SHA-256: `3ce9c0b79a9dbc4fb8724061754b0f3adfdbbeff56aa9caca71b8c5353fff9b7`
- Scope: current public terms and open-source search plus workbook schema/coverage audit; no workbook edits, API requests, restricted scraping, account access, or expenditure.

## Finding

**No source was verified that meets all three conditions at once:** current outlet-level rating and review count, free access, and permission to retain the values in this standalone workbook. Public visibility does not by itself establish a data-reuse license. I found no nationwide Singapore government or open-licensed review-count dataset in the bounded search.

## Current workbook evidence

The current directory has **38,280** active public-access records. `Rating / Review Count` is blank for all **38,280**. The government `SFA Status / Hygiene Grade` field is populated on all **38,280** records; that is an official regulatory/hygiene status, not a public customer-review score/count. The companion `Coverage & Sources` sheet explicitly says no ratings were inferred or copied from Mapbox and that blank means unavailable or unverified.

## Candidate sources and limits

| Source | What is available | Free and reusable for this workbook? | Evidence / limit |
|---|---|---|---|
| Google Maps website | Broad outlet coverage; public profile scores/counts | **No for bulk collection/storage** | Current Maps Platform terms prohibit scraping, bulk extraction of Places content, copying/saving user reviews, and using Maps Core Services to create or augment a listings/directory service. [Google Maps Platform Terms, §3.2.3](https://cloud.google.com/maps-platform/terms). |
| Google Places API | Structured place/rating data through paid API | **Not established as zero-spend or persistable** | Places content cannot be pre-fetched/cached/stored beyond the specified exceptions; place IDs are exempt, rating/review content is not. The general terms also bar using Places content to create or augment a listings/directory service. API results require attribution and access to the specific source reviews. [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies). Billing is pay-as-you-go by SKU; free monthly caps exist but don’t establish zero spend without project-specific billing controls and quotas. [Pricing overview](https://developers.google.com/maps/billing-and-pricing/overview). No API call was made. |
| Grab / GrabFood | Public merchant pages may show delivery ratings | **No for a bulk outlet directory without written permission** | Singapore Terms prohibit public/commercial use or compiling a directory from Platform content, review republication, and data mining/scraping absent an exception or permission. [Grab Singapore Terms of Service](https://www.grab.com/sg/terms-policies/transport-delivery-logistics/). |
| Foodpanda | Existing workbook history contains platform-specific outlet observations | **Not certified for persistent reuse** | Current consumer terms do not provide an open data license for ratings/review counts. They reserve rights in platform material and third-party marks/content. A visible score is not a verified blanket license to copy and keep it in a separate catalogue. [Foodpanda Singapore Terms](https://www.foodpanda.sg/contents/terms-and-conditions.htm). |
| Oddle | Merchant online-ordering/menu pages | **No ratings source verified** | Oddle’s current Terms of Service are merchant/platform terms, do not define a rating/review metric, and reserve rights in platform content absent express consent. [Oddle Terms of Service](https://docs.oddle.me/general/terms-of-service/). |
| OpenStreetMap | Open place records; optional `stars=*` tag | **No customer rating/count** | OSM documents `stars=*` for recognized classification/awards and excludes ratings from subjective-review platforms; it has no standard review-count field. [OSM restaurant mapping](https://wiki.openstreetmap.org/wiki/Map_Features/restaurant), [OSM `stars` tag](https://wiki.openstreetmap.org/wiki/Key:stars). |
| data.gov.sg / SFA | Licensed establishment list and hygiene grades | **Open official status, but not customer review counts** | Existing SFA status/grade field is already complete in this workbook. The source concerns licensed establishments/official grading, not user reviews. [SFA Eating Establishments](https://data.gov.sg/datasets/d_1f0313499a17075d13aae6ed3e825bc6/view), [SFA grading dataset](https://data.gov.sg/datasets/d_546a95c5e6a0a264a82247ec107a0629/view). |

## Safe data decision

- Keep `Rating / Review Count` blank unless an outlet-level source has a clear reuse grant (or direct permission) and exposes a current score plus count.
- Preserve any previously observed delivery-platform ratings only as explicitly dated, outlet-matched platform snapshots in source evidence; do not relabel them as Google or general dine-in ratings, and do not automatically roll them into the canonical field.
- Use SFA hygiene grade as its existing separate regulatory field. Do not describe it as customer rating/reviews.
- A free source that lacks review counts, or a source that lets users view scores but does not permit persistent reuse, does not meet this task’s conditions.

## Source snapshot

Machine-readable audit: `data/source_snapshots/rating_source_feasibility_20261018.json`.
