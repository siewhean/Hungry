# Asset Provenance And Bundle Inventory

Updated: 2026-05-24

Scope: release-readiness evidence for image assets included in the first Full Audit V1 split PR.

## Mobile App Assets

| bucket | path | source | current status |
| --- | --- | --- | --- |
| Discover food/card art | `src/assets/discover/` | Generated bitmap food art and app-card artwork from the Discover asset pass. No third-party stock or scraped food photos are referenced. | 10 PNG files, 10 referenced, 0 unreferenced; 4.77 MiB total and under the 6 MiB mobile budget. |
| Passport/gamification art | `src/assets/gamification/passport/` | Generated locally from `scripts/generate-passport-assets.mjs`; source is procedural bitmap generation, not third-party stock art. | 10 PNG files, 10 referenced, 0 unreferenced; 0.43 MiB total and under the 1 MiB passport budget. |

## Web-Only Assets

| bucket | path | source | current status |
| --- | --- | --- | --- |
| Marketing food images | `marketing/website/web-v2/public/images/food/` | Web-only generated marketing food imagery. Keep out of the mobile bundle unless an app reference is added intentionally. | 6 PNG files, 6 referenced by scanned source, 13.5 MiB total and under the current web-only budget. |

## Verification

| date | command | result |
| --- | --- | --- |
| 2026-05-24 | `npm run audit:assets` | Pass; Discover 10/10 referenced at 4.77 MiB, Passport 10/10 referenced at 0.43 MiB, marketing web food 6/6 referenced at 13.5 MiB. |

## Release Notes

- Mobile public v1 may keep the referenced Discover assets in the mobile bundle.
- Passport assets are included for the gated gamification surfaces and remain within the configured mobile asset budget.
- Marketing web food assets are audited separately as web-only assets and should not be imported into the mobile bundle.
