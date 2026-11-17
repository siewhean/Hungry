# Public Website Scaling Report

Date: 2026-06-07
Active site: `marketing/website/web-v2`
Legacy site: `marketing/web`

## Scaling Strategy

- Prefer static generation and cacheable pages for public SEO surfaces.
- Keep private merchant/console/API routes out of sitemap and robots-allowed crawl paths.
- Use canonical metadata and structured data helpers from `marketing/website/web-v2/src/lib/seo`.
- Do not emit fake ratings, review counts, hours, or verification claims.

## Static Validation

| Gate | Command |
| --- | --- |
| SEO readiness | `npm --prefix marketing/website/web-v2 run seo:validate` |
| Sitemap | `npm --prefix marketing/website/web-v2 run seo:sitemap` |
| Structured data | `npm --prefix marketing/website/web-v2 run seo:structured-data` |
| Route security | `npm --prefix marketing/website/web-v2 run security:audit` |
| Type/lint/build | web-v2 local gates in `tasks/verification.md` |

## Required Website Checks

- Sitemaps include only indexable public pages.
- `robots.ts` disallows API, console, merchant app, auth, privacy-sensitive routes, and draft surfaces.
- Dynamic pages must be noindexed until source-backed live data is available.
- JSON-LD must be generated from validated site content only.
- `llms.txt` and `llms-full.txt` must avoid unsupported claims.

## External Blockers

- Deploy preview validation.
- Search Console and Bing submission.
- Rich-results validation against deployed URLs.
- CDN/cache header proof.
- Crawler-log monitoring after launch.
