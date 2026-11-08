# Source ladder

Use the highest rung that has the stall. Move down only when a rung has nothing for that stall. Record which rung produced each row (`source_type` in the sidecar).

| Rung | `source_type` | Allowed access | Yields | Known limits | When blocked or unclear |
|------|---------------|----------------|--------|--------------|-------------------------|
| 1 | `saved_page` | Page the owner saved from their own browser after passing any human check, parsed offline. No request is made. | Whatever the page embeds: items, prices, images, menu schedule, ld+json identity | Only the menu active at save time. Dynamic pages may need the owner to open each tab/menu. Platform prices are delivery prices. Data-reuse terms are an open decision | Ask the owner to re-save. Never fetch it yourself |
| 2 | `official_site` | The stall or brand's own site or official ordering page, only after reading robots.txt and the terms and recording that automated reads are allowed. Concurrency 1, delay >= 3 s, honour `Crawl-delay` | Dine-in menu where published; usually the best price basis and descriptions | Many stalls have no site. PDF/image menus need manual transcription (flag `verified: false`). Group sites list menus for all outlets | robots.txt disallows, terms forbid, or any 403/challenge: stop, record `blocked`, report, move on |
| 3 | `official_api` | Official, partner or licensed APIs or feeds the owner has credentials for. The owner supplies the key in their own terminal; never ask for it in chat | Structured menus, sometimes outlet IDs and allergen data | Licence terms may limit storage or republishing. Rate limits apply | 401/403/429: stop, report. Do not rotate keys or IPs |
| 4 | `open_data` | data.gov.sg, SFA and other public datasets | Licence, address and status data; rarely dishes | Not menu data. Used for identity and enrichment, not dishes | Dataset withdrawn or changed schema: report |

Not on the ladder, never allowed: stealth plugins, fingerprint spoofing, user-agent rotation to dodge detection, proxy or IP rotation, CAPTCHA solving, headless-evasion tricks, replaying someone else's session or cookies, scraping behind a login the owner did not authorise for this purpose. `scrape_foodpanda_batch.mjs` (puppeteer-extra stealth) and `scripts/test_foodpanda_stealth.js` fall in this category and must not be run.

## Block handling (every rung)
1. Signs: HTTP 403/429, a page titled "Access denied" / "Confirm you are human" / "Just a moment", PerimeterX or Cloudflare markers, an empty page where the owner's saved copy has data.
2. Stop requests to that host immediately. No retry loop. One status line: `blocked <host> <url> <UTC time> <signal>`.
3. Write the status to the done-file so a resume does not retry; list it in the report.
4. Continue with the next source or stall on another host.
5. Backoff for ordinary 5xx or timeouts only: 5 s, 10 s, 20 s, then give up on that URL. This is not for 403/429.

## Run discipline
- Pilot 3-5 stalls and report counts before any batch.
- Concurrency 1. Fixed delay of at least 3 s between requests to one host. Do not parallelise across URLs of the same host.
- Resumable: append finished stall IDs to a done-file; skip them next run. Blocked and failed stalls are written there with their status.
- No full crawl without the owner's explicit yes in chat. The 9,196-row list `data/clean-slate/foodpanda-urls.csv` is not a to-do list: 7,286 licences share 1,577 URLs, so most rows cannot be attached safely.

## Foodpanda embedded-data map (rung 1, from the pilot snapshots)
Snapshots: `data/source_snapshots/foodpanda_pilot_20261025/` (`*.stripped.html` are small, test-ready copies). Parser: `scripts/extract_foodpanda_menus.mjs`, tests: `node --test scripts/extract_foodpanda_menus.test.mjs` (12 tests).

| Need | Where in the page | Notes |
|------|-------------------|-------|
| Vendor code, canonical URL | `<link rel="canonical" href=".../restaurant/<code>/<slug>">` | The code is the platform ID, not an SFA licence |
| Stall identity | `<script type="application/ld+json">` with `"@type":"Restaurant"`: `name`, `address.streetAddress` (carries the unit, e.g. `#01-155`), `address.postalCode`, `geo.latitude/longitude`, `servesCuisine`, `priceRange`, `aggregateRating` | Use for identity checks. Outlets of one brand have different vendor codes and units (PS.Cafe Great World vs Raffles City) |
| Stall opening hours | ld+json `openingHoursSpecification[]` {dayOfWeek[], opens, closes} | Stored as `stall_hours`; separate from menu hours |
| Menu data (preferred) | Apollo state: `apollo:{ initialState: {...} }` in an inline script | Parse with string-aware brace matching; `undefined` literals become null |
| Scheduled menu | `RestaurantMenu:<id>` {id, title, description, startTime, endTime, expeditionType, categories[__ref]} | `title` such as "Brunch (Weekends)" and `description` carry weekday text; start/end are time of day only. Weekday names are not inferred. Only the menu active at save time is embedded |
| Category | `RestaurantMenuCategory:<id>` {title, products[__ref]}; `RestaurantMasterCategory` groups (including "Popular") | Dedupe "Popular" copies against real categories |
| Product | `RestaurantProductData:<id>` {title, description, image.url, isSoldOut, isBundle, isAlcoholicItem, isCustomizable, dietaryAttributes, priceAttributes{originalPrice, discountedPrice, displayFromTag}, variations[__ref]} | Prices are dollars, not cents. `dietaryAttributes` was null in the pilot; if populated, record the exact platform wording as evidence |
| Size/option prices | `RestaurantVariationData:<id>` {price} | Distinct prices become `variation_prices_sgd`; base = original price or lowest variation. Discount stays separate |
| Images | `image.url` bare URL (no query) | The page's `<img>` uses `?width=128&height=128`; removing the query returns the original (1440 px wide in the pilot). Asking for a larger size only upscales |
| Fallback (DOM) | `data-testid="menu-product"`, `menu-product-name`, `-price` ("from S$ 7.50"), `-description`, `-image` | Used only when no Apollo state; menu and category fields stay null. Nameless tiles in the Popular carousel are skipped |

Extractor output row (JSON per line): `stall_licence_no` (vendor code in snapshot mode), `stall_name` (page name in snapshot mode), `source_url`, `source`, `verified`, `category`, `menu_id`, `menu_title`, `menu_description`, `menu_hours`, `item_name`, `price_sgd`, `discounted_price_sgd`, `price_from`, `variation_prices_sgd`, `description`, `image_url`, `sold_out`, `stall_hours`. Before merging add `licence`, `source_type`, `captured_at` and the `page_*` identity fields (see SKILL.md step 5).

## Grab pages
Same rung 1 rule. The Doc 2 working copy already holds many Grab rows (image host `huawei-food-cms.grab.com`). Check a saved page's embedded JSON before writing a parser; do not reuse Foodpanda paths. Existing images there are `compressed_webp` URLs; whether a full-size variant exists is unverified.

## Official sites (rung 2)
Read `https://<host>/robots.txt` and the terms page first; record both findings in the report. Prefer JSON-LD `Menu`/`MenuItem` or an embedded JSON feed over scraping markup. Dine-in sites usually let you set `price_basis: dine_in`; confirm from the page wording (for example "dine-in menu") rather than assuming. Group sites often list one menu for many outlets: attach only where the page names the outlet or the owner confirms the menu applies to all outlets of that brand.
