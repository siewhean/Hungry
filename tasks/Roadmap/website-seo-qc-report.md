# Website SEO QC Report

Date: 2026-06-18

## Fixed / Verified

- Added `/contact` to the public metadata registry and route template validator.
- Sitemap validation passes and continues to exclude private routes.
- Robots rules block `/api/`, `/console/`, `/merchant/`, and `/_next/`.
- Structured-data validation passes and continues to reject unsupported rating/hour claims.
- Footer Contact now points to `/contact`, giving crawlers and users a stable support page.
- Added `npm run seo:links` rendered-link crawl for the local production server.
- Fixed rendered SEO pages so area/MRT/dish-area pages only link to backed place pages and backed dish-area pages.
- Rendered-link crawl passed on `http://127.0.0.1:3010` after checking 74 internal routes.

## Remaining SEO Blockers

- Need Search Console/Bing submission proof after deployment.
- Need Rich Results validation against the deployed URL.
- Dynamic source-backed stall/menu/rating/hour pages remain future work; current SEO pages must not invent those facts.

## Command Evidence

- `cd marketing/website/web-v2 && npm run seo:validate`: passed on 2026-06-18.
- `cd marketing/website/web-v2 && npm run seo:sitemap`: passed on 2026-06-18.
- `cd marketing/website/web-v2 && npm run seo:structured-data`: passed on 2026-06-18.
- `WEBSITE_BASE_URL=http://127.0.0.1:3010 npm run seo:links`: passed on 2026-06-18; checked 74 internal routes.
