# Asset Provenance And Bundle Inventory

Updated: 2026-05-21

Scope: release-readiness evidence for image assets touched by `frontend-design-overhaul`.

## Mobile App Assets

| bucket                    | path                                                   | source                                                                                                                                                       | current status                                                                                                                       |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Discover food/card art    | `src/assets/discover/`                                 | Generated with the built-in image generation workflow during the 2026-05-05 Discover asset pass. No third-party stock or scraped food photos are referenced. | 10 PNG files, 10 referenced, 0 unreferenced; compressed/downscaled on 2026-05-21 from 23.28 MiB to 4.77 MiB.                         |
| Passport/gamification art | `src/assets/gamification/passport/`                    | Generated locally from `scripts/generate-passport-assets.mjs`; source is procedural bitmap generation, not third-party stock art.                            | 10 PNG files, 10 referenced, 0 unreferenced; 1.54 MiB total. Public production remains gated by `FEATURE_FLAGS.gamificationEnabled`. |
| Hungry logo assets        | `assets/images/Logo/`, `assets/images/hungry-icon.png` | Internal Hungry brand artwork in the repo.                                                                                                                   | App icon uses `assets/images/Logo/hungry_logo_icon_transparent.png`; other logo exports are brand-support assets.                    |

## Web-Only Assets

| bucket             | path                                           | source                                                                                                  | current status                                                                                                                   |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Marketing food art | `marketing/website/web-v2/public/images/food/` | Generated top-down food image set for the marketing website. No app import path references this folder. | 38 PNG files, 38 referenced by the web-v2 site, 95.6 MiB total; keep in the marketing-web PR bucket and out of mobile app scope. |

## Verification

| date       | command                          | result                                                                                                                                      |
| ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-21 | `npm run audit:assets`           | Pass; mobile Discover 10/10 referenced at 4.77 MiB, Passport 10/10 referenced at 1.54 MiB, marketing web food 38/38 referenced at 95.6 MiB. |
| 2026-05-21 | `file src/assets/discover/*.png` | Pass; Discover food images are 512 x 512 PNGs and wide cards are 720 px max-width PNGs after compression.                                   |

## Release Notes

- Mobile public v1 may keep the referenced Discover assets in the mobile bundle.
- Passport assets remain production-safe only because Passport/Missions are feature-gated out of production.
- Marketing web food assets are not mobile release blockers, but should be compressed or CDN-backed before the marketing website production launch.
