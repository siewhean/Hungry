# Field-fill matrix: Doc 2 (Full Menu & Price)

Doc 2 = `data/Hungry Full Menu & Price - 21 Oct 2026.csv` (sheet `Hungry Full Menu & Price`). The working copy has 28 columns; `HEAD` has 23 (no Vegan, Pork-free, Gluten-free, Dairy-free, Nut-free). The helper reads the target's header and writes only the columns it finds, in that order. A column it does not know makes it stop.

Conventions observed (working copy, 106,170 rows, 2026-11-05):
- Price: plain decimal with two places (`7.80`); messy legacy text exists (`From S$55.00`, `$2.30++`, `M $7.5 L $9`, 12,592 blank). New rows are always plain `0.00`.
- Dates: `YYYY-MM-DD` in `Last Verified Date`. The value is the capture date (Singapore time), not proof of verification.
- Dietary and allergen cells: `Yes`, `No`, `Unknown`. Default `Unknown` for Halal, Vegetarian, Beef, Milk, Eggs, Fish, Crustaceans, Soy, Peanuts, Tree nuts, Wheat. Default blank for Vegan, Pork-free, Gluten-free, Dairy-free, Nut-free (blank = not asserted). `Intolerances` default `Not assessed — ingredient list unavailable`.
- Unverified rows carry the suffix ` | Menu item and price not independently verified; do not publish as a confirmed outlet menu.` in Description / Notes (17,803 rows). Chain-level URLs carry a `Source scope: ... does not verify this specific outlet` note. Multi-part notes are joined with ` | `.
- Hierarchy (lessons): `Vegan = Yes` implies `Vegetarian = Yes`; `Halal = Yes` implies `Pork-free = Yes`. Conflicts go to review.

Key to the columns below. Source tiers: A = value from the page's own data, B = join from workbook/master by SFA licence, C = derived by rule, D = default/blank.

| # | Column | Source | Rule | Fallback | Allowed values |
|---|--------|--------|------|----------|----------------|
| 0 | F&B Venue Name | B: existing Doc 2 rows for the licence, else master `F&B Name` | Never taken from the page. Never invented (lessons). | Row rejected: `licence_unknown` | Existing workbook spelling |
| 1 | SFA Licence | A/B: row `licence` (extractor `stall_licence_no` only when it is a real licence, not a 4-letter vendor code) | Must match `^[A-Z0-9]{8,14}$` and exist in Doc 2 or master | Rejected: `licence_missing_or_invalid` / `licence_unknown` | One licence per row |
| 2 | Address | B: Doc 2 row or master `Full Address` | Copied as is. Page address (ld+json `streetAddress`) is used only to compare the unit | Rejected with the row | Workbook text |
| 3 | Postal Code | B: Doc 2 or master `Postal Code` | 6 digits, zero-padded. Must equal ld+json `postalCode` | `postal_mismatch` to review | `^\d{6}$` |
| 4 | Menu Item / Dish Name | A: Apollo `RestaurantProductData.title`; DOM `menu-product-name`; official site item title | Entities decoded, trimmed, NFC, trailing `,;:` removed, brand casing kept, max 200 chars. Names starting `=`/`@` or containing `<` `>` rejected | Row rejected: `item_name_missing`, `markup_in_text`, `formula_injection` | Free text |
| 5 | Category / Section | A: Apollo `RestaurantMenuCategory.title`; site section heading | "Popular", "Featured", "Recommended", "Most liked" become blank (they duplicate the real category) | Blank | Free text; source casing kept |
| 6 | Price (SGD) | A: Apollo `priceAttributes.originalPrice`, else lowest `RestaurantVariationData.price`; DOM tile price; site price | Plain decimal SGD. `++`, `from`, `S$` stripped. Several prices: lowest in the cell, all in Description / Notes ("Price options (SGD): ...") and sidecar `price_options`. Discounted price never replaces the base; it is noted as "Promo price S$x at capture" and kept in the sidecar. Accepted range 0.50 to 100.00 | `price_missing`, `missing_base_has_promo`, `price_out_of_range`, `add_on_price`, `price_unparseable_*` go to review | `^\d+\.\d{2}$` |
| 7 | Description / Notes | A: Apollo `description`; site blurb | Entities decoded. Appended in this order, joined with ` | `: price options, `++` note, promo price, `Available: <menu title> HH:MM-HH:MM`, `Sold out at capture`, delivery note, unverified disclaimer | Blank | Free text, under 32,000 chars |
| 8 | Dish Image URL | A: Apollo `image.url`; DOM `menu-product-image` src; site image | Full-size URL: resize query (`width`, `height`, `quality`, `w`, `h`, `fit` ...) removed; Drupal `/styles/<x>/public/` removed. Thumbnail-only URL is not written (sidecar `image_quality: thumbnail_only`). Same URL on more than 5 rows (workbook plus new) is blanked as generic (`image_reuse_count`) | Blank | `https://` or `http://` URL |
| 9 | Menu Source URL | A: page canonical URL (`<link rel="canonical">`) or the official page URL | Must be the page the row was read from. A URL already used by another licence in Doc 2, or by several licences in the input, is rejected | `url_belongs_to_other_licence`, `url_shared_by_multiple_licences` | http(s) URL |
| 10 | Last Verified Date | C: date part of `captured_at` in Singapore time | `captured_at` needs a timezone, no future dates, not older than `--max-age-days` (30). Does not mean human-verified | Row rejected: `captured_at_invalid`, `stale_capture`, `captured_at_in_future` | `YYYY-MM-DD` |
| 11 | Halal | A only if explicit: certificate/listing for the dish or stall, stated in `dietary.Halal.evidence` | Venue-level Halal is not copied onto dishes unless the evidence says the menu is certified. Yes implies Pork-free Yes | `Unknown` | `Yes` `No` `Unknown` |
| 12 | Vegetarian | A only if explicit (menu label, platform `dietaryAttributes` when populated) | No inference from names. Yes with Beef/Fish/Crustaceans Yes is a conflict | `Unknown` | `Yes` `No` `Unknown` |
| 13 | Vegan | A only if explicit | Yes forces Vegetarian Yes; conflicts with Milk/Eggs Yes | blank | `Yes` `No` blank |
| 14 | Pork-free | A explicit, or C from Halal Yes | | blank | `Yes` `No` blank |
| 15 | Gluten-free | A only if explicit | | blank | `Yes` `No` blank |
| 16 | Dairy-free | A only if explicit | | blank | `Yes` `No` blank |
| 17 | Nut-free | A only if explicit | | blank | `Yes` `No` blank |
| 18-26 | Beef, Milk, Eggs, Fish, Crustaceans, Soy, Peanuts, Tree nuts, Wheat | A only from an ingredient or allergen statement on the source | Substring guessing is forbidden ("ham" in "champagne"). An absent statement is `Unknown`, never `No` | `Unknown` | `Yes` `No` `Unknown` |
| 27 | Intolerances | A only from an allergen statement | Free text from the source | `Not assessed — ingredient list unavailable` | Free text |

## Evidence format for dietary claims (input row)
```json
"dietary": {"Halal": {"value": "Yes", "evidence": "MUIS certificate image on stall page, 2026-10-25"},
            "Vegan": {"value": "Yes", "evidence": "menu label: (VG)"}}
```
A claim with no evidence text is dropped and counted as `dietary_claim_dropped_no_evidence`. Unknown column names and values other than Yes/No are rejected.

## Fields that have no Doc 2 column (kept in the provenance sidecar)
`source_type` (saved_page, official_site, official_api, open_data), `source` (platform), `captured_at` (ISO-8601 with timezone), `recrawl_after`, `verified`, `verified_by`, `verified_at`, `price_basis` (delivery, dine_in, unknown; delivery platforms default to delivery), `price_from`, `price_options`, `discounted_price_sgd`, `price_excludes_service_charge`, `menu_id`, `menu_title`, `menu_description`, `menu_hours` {start, end, expedition_type}, `menu_scope`, `other_menus_captured`, `also_in_menus`, `stall_hours`, `image_url_original`, `image_quality`, `image_in_workbook`, `image_reuse_count`, `sold_out`, `identity` {postal_match, unit_match, name_similarity, distance_m, confirmations}.

## Item types
Only `dish`, `drink`, `side`, `dessert`, `set_meal` are appended. `add_on`, `bundle`, `promo`, `modifier` (and any price starting `+`) are queued as `item_type_<x>` / `add_on_price`. Foodpanda's `isBundle` flag maps to `bundle` (the pilot extractor does not read it yet).
