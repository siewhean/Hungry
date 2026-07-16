# PR-115 Web CSP Runtime Evidence

Date: 2026-07-17

Implementation candidate: `58d090ad84a48cb62cb32418d736ca9d5c147949`

Outcome: script and style-element nonce boundary passes; residual inline style attributes remain P2

## Enforced invariant

Every HTML response receives a fresh server-generated nonce. The proxy overwrites inbound CSP and
nonce headers, forwards the trusted nonce to Next.js rendering, and applies one enforced policy to
normal, redirect, denial, and private/API outcomes. Production scripts require the nonce and
`strict-dynamic`; script attributes and frames are denied; style elements require the nonce; and
`connect-src` plus remote images are narrowed to observed origins.

The implementation deliberately retains `style-src-attr 'unsafe-inline'`. The current FDO site has
roughly 342 React style props plus framework/animation-generated style attributes, and CSP nonces do
not authorize style attributes. This is a scoped P2 CSS-injection residual, not a claim that every
`unsafe-inline` token is removed. PR-115 remains open until reachable style attributes are migrated
without changing the FDO design and this directive can be removed.

## Runtime verification

Production Playwright exercised Home, Foodies, Merchants, Waitlist, Privacy, Singapore SEO, merchant
disabled/redirect, and console-denial route classes. It verified:

- matching response, Next/Flight, JSON-LD, and style-element nonces;
- unique nonces across requests and replacement of hostile inbound CSP/nonce headers;
- blocking of a nonce-less inline event handler and injected style element;
- successful client navigation, image/layout behavior, and zero legitimate CSP violations;
- merchant disabled and enabled/redirect modes; and
- Vercel Analytics mode, allowing only the exact same-origin `/_vercel/insights/script.js` trusted
  descendant under `strict-dynamic`.

The final browser gate, web lint/typecheck/security audit, 118-page production build, 1,438 KiB
bundle budget, rendered-link crawl, keyboard smoke, root security contracts, and staged Gitleaks
passed. The full root source suite passed 682 total / 680 pass / 2 credential-gated skips. No live
Supabase, data, or production write occurred.

Independent QA found one CSS Module keyframe-name mismatch. The animation was moved to module-owned
classes, the compiled CSS was checked, and the final independent recheck returned `No findings`.

## Performance trade-off

Per-request nonces make the audited public HTML routes dynamic. Three cold Lighthouse runs were
therefore repeated after the CSP change.

| Route | PR-114 median LCP | Nonce-CSP median LCP | Delta | Strict 2.5 s gate |
| --- | ---: | ---: | ---: | --- |
| `/` | 3.198 s | 3.065 s | -0.133 s | Fail, 3.026 s |
| `/for-foodies` | 2.819 s | 2.946 s | +0.127 s | Fail, 2.825 s |
| `/for-merchants` | 2.573 s | 2.719 s | +0.146 s | Fail, 2.713 s |
| `/join-waitlist` | 2.435 s | 2.419 s | -0.016 s | Pass, 2.429 s |

Foodies and Merchants regress by about 0.13-0.15 seconds and lose static/ISR caching eligibility.
PR-114 remains open; deployed p75 CWV evidence is also still required.

## Artifacts and reproduction

- `for-foodies-desktop.png` and `home-mobile.png`: manually reviewed FDO visual receipts.
- `lighthouse/*-run-{1,2,3}.json.gz`: three cold reports per route.
- `lighthouse/*-strict.json.gz`: fail-closed 2.5-second acceptance runs.

Primary commands:

```sh
cd marketing/website/web-v2
npm run security:audit
npm run lint
npx tsc --noEmit --project tsconfig.json --incremental false
npm run build
npm run bundle:budget
WEBSITE_BASE_URL=http://127.0.0.1:3315 npm run security:browser
HUNGRY_PREDEPLOY_BROWSER=1 WEBSITE_BASE_URL=http://127.0.0.1:3315 npm run predeploy:local
```

Verify artifact hashes with:

```sh
find tasks/release-evidence/web-csp-2026-07-17-pr115 -type f ! -name README.md -print0 \
  | sort -z \
  | xargs -0 shasum -a 256
```
