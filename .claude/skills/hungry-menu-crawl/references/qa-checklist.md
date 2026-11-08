# QA checklist

Run on the dry-run summary, the review queue, and a sample of 10 new rows per stall. Every item names the helper reason code where one exists. A failed check means do not apply; fix the input or queue the rows.

## 1. Identity (the audit's biggest failure)
- [ ] Each URL maps to one licence (`url_shared_by_multiple_licences`, `url_belongs_to_other_licence`). The audit found 7,286 licences wrongly sharing 1,577 URLs; a chain-level page does not verify an outlet.
- [ ] Postal equals the page's ld+json postal (`postal_mismatch`). Unit equals the page unit (`unit_mismatch`): `#01-104` is not `#01-101`.
- [ ] Numbers in names agree (`name_number_mismatch`): Newton 32 against a Newton 51 page was a real case. A food-centre page is not a stall.
- [ ] Two independent confirmations among postal, unit, name similarity >= 0.6, coordinates within 300 m (`identity_weak`), or an owner sign-off in `identity_confirmed_by`. Sign-off never overrides a mismatch.
- [ ] Venue name, address, postal in the new rows equal the existing Doc 2 / master values, not the page's.
- [ ] Licence is a real SFA licence, not a platform vendor code (`licence_missing_or_invalid`).
- [ ] Anything that changes which outlet a row is, or merges/deletes stalls: hand to `hungry-directory-crawl-verify` (Tier C) and `fb-stall-data-cleaning`.

## 2. Price sanity
- [ ] Prices are plain `0.00`; none below 0.50 or above 100 reached the workbook (`price_out_of_range`).
- [ ] No `from`, `++`, `$`, ranges or lists in the Price cell; size options appear in Description / Notes.
- [ ] Add-ons (`+$1.00`), bundles, promos and modifiers are absent (`add_on_price`, `item_type_*`).
- [ ] Promo price never filled a missing base price (`missing_base_has_promo`).
- [ ] Spot-check 5 prices against the saved page by eye. Dollars, not cents; the range check catches 750 for 7.50 but not a silent 10x error inside S$0.50 to S$100, so the eyeball check matters.
- [ ] `price_changed_existing` rows reviewed by the owner; nothing silently overwritten.
- [ ] Delivery prices marked `price_basis: delivery` and the Description carries the delivery note.

## 3. Duplicates
- [ ] No two new rows share licence + normalised name + price (`duplicates_in_input` in the summary is collapsed, not appended).
- [ ] Re-running the helper reports `already present` for every row and writes nothing.
- [ ] "Popular" / featured copies did not win over the real category.
- [ ] Same dish name at a different price already in Doc 2 is queued, not appended.

## 4. Text hygiene
- [ ] No `&amp;`, `&#38;`, `&#039;` left in names or notes (also check the existing 46 rows only if the owner asks).
- [ ] No stray whitespace, zero-width characters, trailing commas ("Coke,").
- [ ] Brand casing and CJK names are intact; nothing was blanket title-cased.
- [ ] No cell starts with `=` or `@` (`formula_injection`).
- [ ] No synthetic placeholder names or boilerplate dishes (`tasks/lessons.md`).

## 5. Images
- [ ] Image URLs have no resize query; sample 3 and confirm they load at full size in the owner's browser (the helper does not fetch).
- [ ] Thumbnail-only images are in the sidecar, not the workbook (`image_thumbnail_not_written`).
- [ ] No URL is used on more than 5 rows (`image_generic_reuse_blanked`). Stall logos or brand CDN images must not appear on another brand's dishes (lessons).

## 6. Dietary and allergens
- [ ] Every non-default dietary value has evidence text in the input row.
- [ ] No venue-level Halal/Vegan copied to dishes; no inference from dish names.
- [ ] Hierarchy holds: Vegan Yes implies Vegetarian Yes; Halal Yes implies Pork-free Yes (`dietary_conflict` otherwise).
- [ ] Defaults left alone: `Unknown` (Halal, Vegetarian, allergens, Wheat), blank (Vegan, Pork-free, Gluten-free, Dairy-free, Nut-free), `Intolerances` = "Not assessed — ingredient list unavailable".

## 7. Provenance and staleness
- [ ] Every new row has a sidecar record: `source_url`, `source_type`, `captured_at` with timezone, `price_basis`, `verified`.
- [ ] `verified` is false unless a named person confirmed (`verified_without_reviewer`).
- [ ] Captures are within 30 days (`stale_capture`) and not in the future.
- [ ] Menu schedule recorded (`menu_id`, `menu_title`, `menu_description`, `menu_hours`, `stall_hours`) and `menu_scope` set. Stalls with only one menu are listed for the owner (`other_menus_captured: false`).
- [ ] `Last Verified Date` equals the capture date, not today's date.

## 8. Write safety (apply runs)
- [ ] Free space was >= 3x file sizes; the helper refused otherwise.
- [ ] Backup exists, hash-verified; restore command saved in the report.
- [ ] CSV row count = old + appended; first old rows byte-identical (the helper appends; compare the first 1 MB with `cmp` if in doubt).
- [ ] XLSX built from the CSV, `zipfile.testzip()` clean, row and column counts equal, sheet name `Hungry Full Menu & Price`. Never a CSV saved under an `.xlsx` name.
- [ ] No DB writes. Supabase ingestion is a separate reviewed migration.
- [ ] `tasks/session-log.md` line appended; `tasks/verification.md` updated for broad runs.

## Review-queue reason codes
`invalid_json`, `licence_missing_or_invalid`, `licence_unknown`, `source_url_missing_or_invalid`, `source_type_invalid`, `price_basis_invalid`, `captured_at_invalid`, `captured_at_in_future`, `stale_capture`, `verified_not_boolean`, `verified_without_reviewer`, `item_type_<x>`, `item_name_missing`, `markup_in_text`, `formula_injection`, `item_name_too_long`, `price_missing`, `missing_base_has_promo`, `price_unparseable_<why>`, `add_on_price`, `price_out_of_range`, `url_shared_by_multiple_licences`, `url_belongs_to_other_licence`, `identity_no_page_evidence`, `identity_weak`, `postal_mismatch`, `unit_mismatch`, `name_mismatch`, `name_number_mismatch`, `coords_mismatch`, `coords_invalid`, `dietary_conflict`, `dietary_value_invalid`, `dietary_unknown_column`, `price_changed_existing`, `cell_too_long`.
