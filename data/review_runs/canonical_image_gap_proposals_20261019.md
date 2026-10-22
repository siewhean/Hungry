# Canonical image-gap audit — 2026-10-19

- Canonical workbook: `data/Hungry F&B Database.Public Access 2026-10-17 Verified Menu Catalogue Refresh 40.xlsx`
- SHA-256 checked before and after read-only audit: `bb74665b20d62a711463850a4d5de0648dc0237c4e1d75e96c9eb5f5a89d2d93`
- Workbook changed: no. Current four-sheet workbook was inspected; `CE13L56C000` (Makan Prata, 133 New Bridge Road #B1-44/45, Chinatown Point, 059413) has a blank approved-image field and no existing image candidate for its licence or these URLs.

## Exact item image proposals

The official [Makan Prata menu](https://www.makanprata.com/menu) is current at observation and prints the same outlet address. It associates direct Wix image links with these item labels. The page returned HTTP 200 and all direct URLs returned HTTP 200 with image MIME.

| Item label | URL response | Requested thumbnail size | Disposition |
|---|---|---:|---|
| Lava Prata Set | HTTP 200, image/jpeg | 144 × 204 | Review-only; exact page alt text; not visually checked |
| Lunch Special For 2 | HTTP 200, image/jpeg | 144 × 201 | Review-only; exact page alt text; not visually checked |
| Banana Prata | HTTP 200, image/png | 49 × 69 | Review-only; exact page alt text; very small thumbnail |

The linked images were not visually inspected, and reuse/display rights are unverified. These transformed thumbnails are low resolution; none is approved or proposed for the active display field until a higher-resolution source and permission are confirmed. No images were downloaded. Full source URLs and response metadata are in `data/source_snapshots/canonical_image_gap_proposals_20261019.json`.

## Delivery-platform images

No Foodpanda, Grab, or Oddle image was proposed. Foodpanda Singapore's current [terms, section 4](https://www.foodpanda.sg/contents/terms-and-conditions.htm) identify images as foodpanda/authorized-third-party IP and prohibit using, copying, reproducing, republishing, distributing, or modifying them without prior express written consent. No such consent was established.
