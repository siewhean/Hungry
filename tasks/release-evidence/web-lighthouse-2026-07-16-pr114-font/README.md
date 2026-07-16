# Web-v2 PR-114 font-delivery follow-up — 2026-07-16

Candidate implementation commit: `52e2cf6c9a9ef922f7346357db71e301a3c3c4b5` on `codex/order-integrity-hardening`

The final production build was served locally on macOS and audited three times per route with Chromium headless and Lighthouse's default mobile throttling. Evidence collection used a 10-second ceiling so all routes completed; the repository default remains 2,500 ms and a separate final strict run failed on the three routes still over target.

```sh
WEBSITE_BASE_URL=http://127.0.0.1:3012 \
HUNGRY_LIGHTHOUSE_OUTPUT_DIR=/tmp/hungry-web-v2-lighthouse-font-optional-<run> \
HUNGRY_LIGHTHOUSE_MAX_LCP_MS=10000 \
npm run perf:lighthouse

WEBSITE_BASE_URL=http://127.0.0.1:3012 \
HUNGRY_LIGHTHOUSE_OUTPUT_DIR=/tmp/hungry-web-v2-lighthouse-font-optional-strict \
npm run perf:lighthouse
```

The retained change marks the existing local Nunito variable font as `display: optional` and disables its HTML preload. Normal local browser QA still resolves the computed family to Nunito; constrained first visits may use Next's metric-adjusted fallback instead of blocking presentation. The package is also explicitly ESM, eliminating module-mode warnings from the security tests. FDO layout, content, colors, imagery, Passport design, motion, and navigation are unchanged.

Two other FDO-preserving experiments were measured and rejected before commit: splitting Home Hero hydration moved its median LCP from 3.189 s to 3.282 s, and replacing the decorative image element with a compressed CSS image layer produced 3.199 s. Neither remains in the candidate.

| Route            | Performance median | Lighthouse LCP runs     | Lighthouse LCP median | Prior median |        Delta | Raw trace LCP subpart median | TBT median |    CLS |
| ---------------- | -----------------: | ----------------------- | --------------------: | -----------: | -----------: | ---------------------------: | ---------: | -----: |
| `/`              |                 93 | 3.306 / 3.190 / 3.198 s |           **3.198 s** |      3.189 s |     +0.009 s |                      0.167 s |      24 ms | 0.0014 |
| `/for-foodies`   |                 95 | 2.821 / 2.819 / 2.807 s |           **2.819 s** |      2.803 s |     +0.016 s |                      0.141 s |    21.5 ms | 0.0333 |
| `/for-merchants` |                 97 | 2.632 / 2.573 / 2.572 s |           **2.573 s** |      2.725 s | **-0.152 s** |                      0.117 s |      19 ms | 0.0013 |
| `/join-waitlist` |                 97 | 2.435 / 2.435 / 2.430 s |           **2.435 s** |      2.509 s | **-0.074 s** |                      0.127 s |      49 ms | 0.0017 |

Home and Foodies remain within run-to-run noise; Merchant improves materially and Waitlist now passes the 2.5-second lab target. The final strict run recorded 3.272 s, 2.801 s, 2.571 s, and 2.423 s respectively, and failed closed on Home, Foodies, and Merchants. PR-114 therefore remains open. Deployed p75 Core Web Vitals are still required and are not claimed.

Browser QA at 390x844 verified the complete FDO Home Hero, healthy images, Nunito computed typography, no horizontal overflow, no warnings/errors, Home-to-Waitlist navigation, Merchant audience switching, and native required-email validation. The web-v2 browser-enabled predeploy gate also passed its 74-route link crawl, nine-page keyboard matrix, disabled Merchant Portal checks, security contracts, and private-route denial checks.

Artifact hashes:

| Artifact                                  | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `home-run-1.json.gz`                      | `d04d017d5951792d312024272e88bbfbfbd7d6e4ac9d539f526376333bc73ec5` |
| `home-run-2.json.gz`                      | `726e7f3ac03241855295b2901639e326e05057c93724ae9e8c1ff12c432cb791` |
| `home-run-3.json.gz`                      | `9288bcc3d51269576b78100c6ea4e05c193b114872a5fb9b4ebf040a0b552da6` |
| `home-strict.json.gz`                     | `cbe836f1dfcbf5b1ed320c958066fd2cd80b81031449ea68ec6c90060267c978` |
| `for-foodies-run-1.json.gz`               | `9dc2381a4fa8a2b2a737a6503b0a37d74efd8595a140eebdaeb0b706dd17030b` |
| `for-foodies-run-2.json.gz`               | `49b4b5049ac52b2f6a98b1ea8f4cb7b225bf003a84b8361832a5bc1f7b112a87` |
| `for-foodies-run-3.json.gz`               | `864812ecfb6769ef64cdf46751f3a5c6cfeaf7ce917cfa78b0f5afcbbe9d6f0e` |
| `for-foodies-strict.json.gz`              | `0964f1dd7cb3bf2e56cdc8b93bf1fdb029ef87d3c32a04f9582f2a3d6b5637af` |
| `for-merchants-run-1.json.gz`             | `4f30408524dc4d419d26d2bf20ee2b048d8cc004534ba39f46978d573406c262` |
| `for-merchants-run-2.json.gz`             | `fdfdc8520b9cd13182c47bd1f0fb39d4e6be8b4e7d870bb867010e15289d53c9` |
| `for-merchants-run-3.json.gz`             | `229c578d6b4eb5c8de902f68dfcd1a78ae802f4393037b305f3e40a413dc9911` |
| `for-merchants-strict.json.gz`            | `cebf811b1b858954c13992e8eea9821a6527786c7fb0e79c14187e39ac095456` |
| `join-waitlist-run-1.json.gz`             | `58fdb0b7a05981b7e093dfb7ac9d5aae2678a5f46957df859857457e4404ded3` |
| `join-waitlist-run-2.json.gz`             | `3301e04d79df5e446577bffedd439d9e83aa68b27c444390cfd550a3faa26883` |
| `join-waitlist-run-3.json.gz`             | `4e647a2de7b131888cc1f5716da2b1e2d9c7b9c07c2418e6568e417098b05cc2` |
| `join-waitlist-strict.json.gz`            | `576aff790a27ec392f7b56eaa2b933f29d384e08870a5c1237e43747f366a724` |
| `home-mobile.jpg`                         | `79572ed5f7b6221060f1a3965c8db62a9d37ace16bd72b0630ea5794dd69353b` |
| `waitlist-merchant-validation-mobile.jpg` | `fc1f3751ce876becd05a57fe9c9c4ed70b4fc505560c1d5e315a6132ba1be644` |
