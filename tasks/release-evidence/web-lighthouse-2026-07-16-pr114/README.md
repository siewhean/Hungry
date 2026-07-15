# Web-v2 PR-114 Lighthouse follow-up — 2026-07-16

Candidate branch: `codex/order-integrity-hardening` (implementation commit pending)

The production build was served locally on macOS and audited three times per route with Chromium headless and Lighthouse's default mobile throttling:

```sh
WEBSITE_BASE_URL=http://127.0.0.1:3012 \
HUNGRY_LIGHTHOUSE_OUTPUT_DIR=/tmp/hungry-web-v2-lighthouse-pr114-final-<run> \
npm run perf:lighthouse
```

The implementation removes above-fold client Reveal wrappers from Foodies, disables nonfunctional mobile compositor hints, removes global/CTA route prefetch during launch, and makes the pure Foodies phone mockup server-renderable. FDO content, layout, styling, navigation, and desktop Home motion remain intact.

| Route | Performance median | Lighthouse LCP runs | Lighthouse LCP median | Raw trace LCP subpart median | TBT median | CLS |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| `/` | 93 | 3.395 / 3.182 / 3.189 s | **3.189 s** | 0.147 s | 23 ms | 0 |
| `/for-foodies` | 96 | 2.801 / 2.804 / 2.803 s | **2.803 s** | 0.127 s | 19.5 ms | 0 |
| `/for-merchants` | 96 | 2.736 / 2.723 / 2.725 s | **2.725 s** | 0.107 s | 18.5 ms | 0 |
| `/join-waitlist` | 97 | 2.509 / 2.519 / 2.506 s | **2.509 s** | 0.107 s | 41 ms | 0 |

All category-score thresholds pass, and the first hardening baseline improved materially. The requested <=2.5-second Lighthouse LCP gate still fails on every route by median, so PR-114 remains open. The repository script now enforces a 2,500 ms default maximum and fails closed instead of treating category scores as an LCP pass. Raw trace subpart totals remain diagnostics; deployed p75 Core Web Vitals are still required and are not claimed.

Chromium screenshots at 390x844 and 1440x1000 were reviewed after the motion/server-boundary changes. Foodies retains its FDO typography, hierarchy, CTAs, phone mockup, and responsive layout; Home retains its mobile FDO Hero composition. No clipping, overlap, or missing above-fold content was found.

Compressed raw report hashes:

| Artifact | SHA-256 |
| --- | --- |
| `for-foodies-run-1.json.gz` | `0703fe08c1b55c2bab5e316c21f4b18a758356b51209cdfe74e1d416e43539d4` |
| `for-foodies-run-2.json.gz` | `481a0486afb9ea3e77848ee01b3028641acf7a71188ca2ba8ec45b24ef94603e` |
| `for-foodies-run-3.json.gz` | `41415a011cf78b8a3ab3ac1355c57cfca7a90bab1ee0a5c04313aeb144ba75bd` |
| `for-merchants-run-1.json.gz` | `90c39c5a2c736c344dd670268a8b60bf904c2db26707a307c68a6578c5c846ea` |
| `for-merchants-run-2.json.gz` | `3ab0fea51a52f0d89e6febcebbb24f54ac704d89435165d66ee036a7120accc2` |
| `for-merchants-run-3.json.gz` | `e99cd0f9bbc3d23cc3659efad51f8b932916ea22050d0c89aeb660e15bcb7706` |
| `home-run-1.json.gz` | `c33de524649868059167958eab1d1b2999776cab2e4bf7bdf5a77735e6a27d6d` |
| `home-run-2.json.gz` | `00b4c1312cbceeded7d8d89740cf067cfc17828d970f1f89252603b720d4be51` |
| `home-run-3.json.gz` | `8524e15da38e9b0ed5023be88553dc6fbbbc7a867748720e48dc1d106a25c04d` |
| `join-waitlist-run-1.json.gz` | `5f24364e6a12d0f0e7567130b3845620f3e77105018f451a68738ec24fb26eeb` |
| `join-waitlist-run-2.json.gz` | `6d88b616494a516d870c23cd00f960a3d4c9fd30d2fc50e146a3f908d2dc5507` |
| `join-waitlist-run-3.json.gz` | `62a4fec1147d5d79ad416706257c16c463e4cd106b1720e1a4d6c8e6247f1b86` |
| `foodies-desktop.png` | `746b9201cde2169fa70c5c75c99d44533ef2d0c009cf09490c92c9f28dc4761e` |
| `foodies-mobile.png` | `701cbb1a8634c7c3c9a4d595eca1b83f48186da47ce97c768452a517df7ec367` |
| `home-mobile.png` | `6196c743a0e658840e9c2e4bb1f6f19ad2495e833fd16c2cfa9758f0cb77e244` |
