# Asset Provenance And Bundle Inventory

Updated: 2026-05-27

Scope: release-readiness evidence for image assets touched by `frontend-design-overhaul`.

## Mobile App Assets

| bucket                    | path                                                   | source                                                                                                                                                                                                                                                    | current status                                                                                                                       |
| ------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Discover food/card art    | `src/assets/discover/`                                 | Generated with the built-in image generation workflow during the 2026-05-05 Discover asset pass. No third-party stock or scraped food photos are referenced.                                                                                              | 10 PNG files, 10 referenced, 0 unreferenced; compressed/downscaled on 2026-05-21 from 23.28 MiB to 4.77 MiB.                         |
| Passport/gamification art | `src/assets/gamification/passport/`                    | Generated locally from `scripts/generate-passport-assets.mjs`; source is procedural bitmap generation, not third-party stock art.                                                                                                                         | 10 PNG files, 10 referenced, 0 unreferenced; 0.43 MiB total. Public production remains gated by `FEATURE_FLAGS.gamificationEnabled`. |
| Onboarding food photos    | `src/assets/onboarding/food/`                          | Generated with the built-in image generation workflow as professional restaurant-style generated food photography for Singapore-relevant onboarding choices. No homemade photos, casual phone shots, stock providers, or scraped food photos are allowed. | 22 PNG files, 22 referenced by onboarding cuisine, dish, taste-question, and result recommendation surfaces; 600 x 600 square sources; 13.80 MiB total. |
| Hungry logo assets        | `assets/images/Logo/`, `assets/images/hungry-icon.png` | Internal Hungry brand artwork in the repo.                                                                                                                                                                                                                | App icon uses `assets/images/Logo/hungry_logo_icon_transparent.png`; other logo exports are brand-support assets.                    |

## Web-Only Assets

| bucket             | path                                           | source                                                                                                  | current status                                                                                                                    |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Marketing food art | `marketing/website/web-v2/public/images/food/` | Generated top-down food image set for the marketing website. No app import path references this folder. | 38 PNG files, 38 referenced by the web-v2 site, 39.32 MiB total; keep in the marketing-web PR bucket and out of mobile app scope. |

## Onboarding Food Image Manifest

All files below are generated professional restaurant/menu photography assets. Keep replacements generated, polished, Singapore-relevant, and free of homemade staging.

Generation rule: use the built-in `imagegen` workflow or another approved generated-image workflow only. Do not replace these files with photographed home cooking, casual phone shots, stock-photo-provider downloads, scraped web photos, watermark-bearing images, or restaurant images copied from third parties.

Prompt baseline for replacements:

```text
Use case: photorealistic-natural
Asset type: square onboarding food card image
Primary request: Generate a professional restaurant/menu photograph of <dish>, suitable for a Singapore food discovery app onboarding flow.
Scene/backdrop: polished restaurant tabletop or hawker-centre menu photography setup with controlled soft lighting.
Subject: <dish> plated cleanly with appetizing texture and realistic ingredients.
Composition: 600 x 600 square crop, food fills the frame without being cut off, clean tableware, no hands, no people.
Quality bar: professional commercial food photography, not homemade, not casual phone photography, no cluttered kitchen counter, no watermark, no text.
```

| file                 | onboarding subject              | generation standard                                                                                                       |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `bibimbap.png`       | Korean bibimbap                 | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `burger.png`         | Western burger                  | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `carrot-cake.png`    | Singapore chai tow kway (fried carrot cake); 600 px copy of the generated web-v2 `carrot-cake-topdown.png` | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `char-kway-teow.png` | Singapore char kway teow        | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `chicken-rice.png`   | Singapore chicken rice          | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `fish-soup.png`      | Singapore fish soup             | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `japanese-curry.png` | Japanese curry rice             | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `kaya-toast.png`     | Singapore kaya toast set        | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `korean-stew.png`    | Korean stew                     | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `kueh-tutu.png`      | Singapore kueh tutu             | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `laksa.png`          | Singapore laksa                 | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `mala-xiang-guo.png` | Mala xiang guo                  | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `mee-siam.png`       | Singapore mee siam; 600 px copy of the generated web-v2 `mee-siam-topdown.png` | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `nasi-briyani.png`   | Nasi briyani                    | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `nasi-lemak.png`     | Nasi lemak                      | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `pandan-cake.png`    | Pandan cake                     | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `pasta.png`          | Western pasta                   | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `pizza.png`          | Western pizza                   | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `ramen.png`          | Japanese ramen                  | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `roti-prata.png`     | Singapore roti prata with curry | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `satay.png`          | Singapore satay                 | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |
| `yong-tau-foo.png`   | Singapore yong tau foo          | Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging. |

## Verification

| date       | command                          | result                                                                                                                                       |
| ---------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-21 | `npm run audit:assets`           | Pass; mobile Discover 10/10 referenced at 4.77 MiB, Passport 10/10 referenced at 1.54 MiB, marketing web food 38/38 referenced at 95.6 MiB.  |
| 2026-05-21 | `file src/assets/discover/*.png` | Pass; Discover food images are 512 x 512 PNGs and wide cards are 720 px max-width PNGs after compression.                                    |
| 2026-05-26 | onboarding food image contract   | Pass; 20/20 onboarding food PNGs are local generated assets, square, at least 600 px, and backed by professional generated-photo provenance. |
| 2026-05-26 | visual contact-sheet review      | Pass; 20/20 onboarding food PNGs read as professional restaurant/menu generated photography, not homemade or casual phone-shot imagery.      |
| 2026-05-26 | `npm run audit:assets`           | Pass; Discover 4.77 MiB, Passport 0.43 MiB, Onboarding food 12.51 MiB, marketing web food 39.32 MiB; all referenced and within budgets.      |
| 2026-05-27 | generated replacement review     | Pass; replaced `chicken-rice.png` with a generated professional Hainanese chicken rice image after visual review found the previous file showed laksa. |
| 2026-05-27 | onboarding food image contract   | Pass; 20/20 onboarding food PNGs are local generated assets, square, at least 600 px, and backed by professional generated-photo provenance. |
| 2026-05-27 | `npm run audit:assets`           | Pass; Discover 4.77 MiB, Passport 0.43 MiB, Onboarding food 12.50 MiB, marketing web food 39.32 MiB; all referenced and within budgets.      |
| 2026-05-27 | legacy quiz URL scan             | Pass; legacy taste-quiz scenarios now point to generated onboarding food asset filenames instead of remote stock-provider URLs.                  |
| 2026-05-27 | onboarding result image check    | Pass; taste-profile result recommendations now reuse the generated local onboarding food-photo map instead of remote dish URLs.                  |
| 2026-10-20 | taste-question dish refresh      | Pass; added `carrot-cake.png` and `mee-siam.png` (downscaled from the generated web-v2 set) for the salty/sour questions; each taste-question dish now appears once. Asam laksa and Rojak show the shared no-photo tile until generated photos are added. |

## Release Notes

- Mobile public v1 may keep the referenced Discover assets in the mobile bundle.
- Onboarding food photos are intentionally generated project assets. Keep them professional, restaurant/menu-style, Singapore-relevant, and non-homemade-looking when replacing any file.
- Onboarding replacement standard: use generated restaurant/menu photography with controlled lighting, polished plating, clean tableware, and no casual home-kitchen counters, phone flash, cluttered homemade staging, watermark text, stock-photo providers, or scraped food photos.
- Passport assets remain production-safe only because Passport/Missions are feature-gated out of production.
- Marketing web food assets are not mobile release blockers, but should be compressed or CDN-backed before the marketing website production launch.
