# Stall logo candidates (for owner review)

Rights-aware logo candidates for Hungry venues. Nothing here is loaded into the database,
and no image was downloaded or rehosted. Each row only records a URL and where it came from.

## Files

- `stall_logo_candidates.xlsx`: sheet `Candidates` (one row per candidate) and `Summary`.
- `stall_logo_candidates.csv`: same rows as `Candidates`, with untruncated venue id lists.
- `find_logo_candidates.py`: the reproducible generator (read-only network access).

## How candidates were found

1. **Brand grouping.** All 29,611 live venues were read via the anon REST key. Names were normalized
   (outlet suffixes like `@ Tampines`, `(Bedok)`, `Pte Ltd`, `Holdings` removed). A group counts as a brand when it has
   3 or more outlets, or is on a short known-brand list. Groups made only of generic food words
   (for example "chicken rice", "drink stall", "mixed rice") are excluded.
2. **Wikidata / Wikimedia Commons** (`source = wikimedia_commons`). The Wikidata item comes from the
   OSM `brand:wikidata` tag (in the read-only Overpass cache) when one exists. Otherwise
   `wbsearchentities` is used, and a match is accepted only for an exact label/alias match with a
   food/business description and a P154 logo claim. The P154 file is resolved on Commons for its URL, size, `LicenseShortName`, `Artist`,
   `AttributionRequired` and `Restrictions`.
3. **Official website** (`official_site_favicon` / `og_image` / `jsonld`). For each distinct host in
   `venues.website_url`, the script checks robots.txt (`urllib.robotparser`) and then makes one homepage GET,
   with User-Agent `HungryBot (contact placeholder)`, 1 request/second per host and a 10 s timeout. Logo URLs
   are taken from `<link rel=icon|apple-touch-icon>`, `og:logo`/`og:image`, and schema.org `logo` in
   JSON-LD. Social and delivery hosts (Instagram, Facebook, Linktree, Grab, etc.) are skipped.
4. **Everything else** gets `source = none` and `rights_status = merchant_upload_required`; the merchant
   uploads a logo through the merchant portal.

## rights_status meanings

| value | meaning |
| --- | --- |
| `cleared_open_licence` | The Commons file has a free copyright licence (CC/PD) and no trademark restriction flag. **It is still a trademark**: you can show it to identify the brand, but it must not imply endorsement. Follow the attribution rules. |
| `trademark_review` | The Commons file is PD-textlogo/ineligible or marked "trademarked". Copyright is fine, but needs a trademark/brand-use check before display. |
| `needs_merchant_permission` | URL found on the merchant's own site. The merchant owns it, so get written permission (or a portal upload) before display. |
| `merchant_upload_required` | No candidate. Ask the merchant to upload a logo. |

Commons logos are matched by brand name. Check that the logo is the Singapore brand and not a
same-name company elsewhere. Favicons are often small (16 to 64 px) and og:image is often a hero photo
rather than a logo, so check both visually.

## confidence column

How sure we are that the logo belongs to that venue or brand (not a rights judgement):

- `high`: Commons logo reached through the OSM `brand:wikidata` tag on Singapore outlets of that brand, or a
  logo/favicon/JSON-LD logo from the venue's own website when that site serves one brand name.
- `med`: Commons logo found by an exact Wikidata label/alias match only, with no OSM confirmation, so a
  same-name brand from another country is possible. Also a website shared by several differently named venues.
- `low`: `og_image` from the website. This is often a hero or food photo rather than a logo.
- blank: no candidate.

## Re-running

`SSL_CERT_FILE=/etc/ssl/cert.pem python3 find_logo_candidates.py --venues venues.json --overpass <overpass cache> --out . --cache <scratch dir>`.
Here `venues.json` is the anon-REST export `venues?select=id,name,website_url`. API and site responses are cached in
the scratch dir, so a re-run only fetches new hosts.

## How to review and send back

1. Open `stall_logo_candidates.xlsx`, sheet `Candidates`. Filter by `rights_status` or `source`.
2. Open `logo_url` in a browser to see the image (do not save or redistribute it).
3. Set `owner_approved` to `Y` (use this logo) or `N` (reject) using the dropdown. Use `notes` for comments,
   such as "use the apple-touch-icon instead" or "wrong brand".
4. Keep at most one `Y` per brand. Do not edit `venue_ids_or_brand`, `logo_url` or `source`.
5. Save as xlsx (keep the filename, or add `_reviewed`) and send it back.

## How approved logos would be loaded (proposal only, not implemented)

- `venues.logo_url` already exists (migration `20260628060000_add_logo_url.sql`) and is read by discovery and
  search (`20260628070000_discovery_feed_venue_logo.sql`, `20260628093552_search_venues_location_logo_url.sql`).
- Proposed: a service-role import script reads rows with `owner_approved = Y`. For
  `cleared_open_licence` rows, it copies the image into the Hungry storage bucket. This is allowed by the
  licence; keep the attribution and licence alongside it. Rehosting avoids hot-linking Commons. The import then
  writes `venues.logo_url` for every id in `venue_ids_or_brand`, plus a provenance record (source URL,
  licence, attribution, reviewer, timestamp), mirroring the existing `media_rights_status` /
  `media_source_url` pattern on dishes.
- `needs_merchant_permission` rows load only after the merchant confirms permission; a portal upload is preferred.
- `trademark_review` rows load only after brand-use sign-off.
