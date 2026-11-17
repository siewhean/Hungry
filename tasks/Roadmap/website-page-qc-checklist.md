# Website Page QC Checklist

Date: 2026-06-18
Scope: `marketing/website/web-v2`.

| Page | Security | SEO | Accessibility | Performance | Content truth | Forms/CTA | Result |
| ---- | -------- | --- | ------------- | ----------- | ------------- | --------- | ------ |
| `/` | public only | metadata + JSON-LD | browser smoke clean | Lighthouse 92 warmed | no fake schema ratings | CTAs internal | Pass |
| `/for-foodies` | public only | metadata | browser smoke clean | Lighthouse 90 | marketing copy only | waitlist CTA | Pass |
| `/for-merchants` | public only | metadata | browser smoke clean | Lighthouse 84 | no private portal exposure | merchant waitlist CTA | Pass; watch LCP |
| `/join-waitlist` | public API rate-limited | metadata | field errors added | Lighthouse 94 | no fake claims | client/API validation | Pass |
| `/contact` | public static | metadata added | semantic links | static | support fallback accurate | email + support links | Added and smoke passed |
| `/privacy` | public static | metadata + legal contract | browser smoke clean | static | provider wording conditional | support email | Pass; legal sign-off pending |
| `/terms` | public static | metadata + legal contract | browser smoke clean | static | UGC/merchant terms present | support email | Pass; legal sign-off pending |
| `/account/delete` | public static | metadata + legal contract | browser smoke clean | static | support fallback, not automated deletion | support email | Pass; legal sign-off pending |
| `/singapore` | public SEO | sitemap/indexed | browser smoke clean | Lighthouse 99 | no fake rating schema | internal links | Pass |
| `/dishes/[dishSlug]` | public SEO | sitemap/indexed | browser smoke clean | Lighthouse 99 | no fake rating schema | internal links | Pass |
| `/hawker-centres/[centreSlug]` | public SEO | sitemap/indexed | browser smoke clean | Lighthouse 99 | no fake rating schema | internal links | Pass |
| `/singapore/raffles-place/chicken-rice` | public SEO | metadata added | route returns 200 | static/SEO | no fake rating schema | internal links | Pass |
| Rendered public internal links | public only | sitemap-derived | n/a | local crawl | unsupported routes removed | 74 routes checked | Pass |
| `/merchant/login` | public auth | noindex/private excluded | keyboard smoke passed | no-store/noindex verified | auth copy only | auth form | Pass; staging auth proof pending |
| `/merchant/signup` | public auth | noindex/private excluded | skip link rendered | no-store/noindex verified | auth copy only | auth form | Conditional |
| `/merchant/forgot-password` | public auth | noindex/private excluded | skip link rendered | no-store/noindex verified | auth copy only | auth form | Conditional |
| `/merchant` private | proxy-gated | excluded | unauth redirect/API denial verified; token-auth keyboard and private-route QC paths wired | no-store/noindex verified | merchant data only | guarded | Real staging merchant smoke pending |
| `/console` private | proxy-gated | excluded | unauth redirect/API denial verified; local token keyboard smoke passed; private-route QC supports admin/non-admin bearer proof | no-store/noindex verified | admin data only | guarded | Staging admin/non-admin proof pending |

## Required Manual Checks Before Deploy

- Browser pass: desktop and mobile for every public page.
- Authenticated private route/API and keyboard pass: merchant private pages with `HUNGRY_MERCHANT_ACCESS_TOKEN` and console admin/non-admin filters with valid staging credentials.
- Authenticated pass: merchant account and console admin account.
- Lighthouse: authenticated merchant/console pages if credentials are available.
