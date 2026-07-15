# Web-v2 Lighthouse receipt — 2026-07-16

Candidate branch: `codex/order-integrity-hardening`

Command:

```sh
WEBSITE_BASE_URL=http://127.0.0.1:3012 \
HUNGRY_LIGHTHOUSE_OUTPUT_DIR=/tmp/hungry-web-v2-lighthouse-final6 \
npm run perf:lighthouse
```

Environment: Next.js production build served by `npm run start` on macOS, Chromium headless, Lighthouse's default mobile throttling. The Merchant Portal was intentionally disabled (`HUNGRY_MERCHANT_PORTAL_ENABLED` was not `1`), so its fail-closed 503 behavior was verified by private-route and keyboard gates rather than treated as a public Lighthouse route.

| Route | Performance | Accessibility | Best practices | SEO | FCP | Lighthouse LCP | Raw trace LCP subpart total (diagnostic) | TBT | CLS | Transfer |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 87 | 94 | 96 | 100 | 1.2 s | 3.9 s | 1.31 s | 110 ms | 0 | 601,378 B |
| `/for-foodies` | 85 | 96 | 96 | 100 | 1.5 s | 3.9 s | 2.29 s | 90 ms | 0 | 566,148 B |
| `/for-merchants` | 99 | 94 | 96 | 100 | 0.9 s | 2.0 s | 0.16 s | 30 ms | 0 | 459,592 B |
| `/join-waitlist` | 97 | 95 | 96 | 100 | 0.9 s | 2.6 s | 0.14 s | 40 ms | 0 | 262,793 B |

All four configured routes pass the repository's category-score thresholds. The script does not enforce LCP, and three of four routes fail the requested Lighthouse LCP <=2.5-second target. Raw trace subpart totals are diagnostic only and are not substituted for the Lighthouse LCP result. Deployed p75 LCP/INP/CLS remains an external release receipt and is not claimed here.

Each report is stored as reproducible compressed Lighthouse JSON:

| Artifact | SHA-256 |
| --- | --- |
| `home.json.gz` | `fb21ebeb9e74cac646da304dd26d991d26fc692428dfc0ab3ffeac7685aa2037` |
| `for-foodies.json.gz` | `847f4add40d3fae6979c6ff95eded0c58f3fbe4b059c8936276863e93659a273` |
| `for-merchants.json.gz` | `02c57d17bdbd84e8df8aa56da9a7caaf0e8fa47938fe15aac8f696e5956219f5` |
| `join-waitlist.json.gz` | `1f313333b55f68b9981ce77f845131c7f23c79ebcbd23087b46d0894aa180562` |

Visual browser evidence is under `tasks/release-evidence/web-visual-2026-07-16/`. Its receipt records zero console/page errors and a reviewed desktop/mobile FDO hero, mobile story interaction, and waitlist layout.
