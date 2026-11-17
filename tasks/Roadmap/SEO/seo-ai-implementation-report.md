# Hungry SEO + AI Discovery Implementation Report

Date: 2026-06-07

## 1. Routes Added

- `/singapore`
- `/singapore/[area]/food`
- `/singapore/mrt/[station]/food`
- `/singapore/[area]/[dish]`
- `/dishes/[dishSlug]`
- `/hawker-centres/[centreSlug]`
- `/malls/[mallSlug]/food`
- `/guides/[guideSlug]`
- `/singapore/[guideSlug]` for dietary, budget, and late-night guide pages
- `/stalls/[stallSlug]` route template only; no pages generated yet

## 2. Pages Generated

- 1 Singapore hub page
- 10 Singapore area pages: Jurong East, Orchard, Chinatown, Tampines, Raffles Place, Bugis, Tanjong Pagar, Serangoon, Bedok, Woodlands
- 10 MRT food pages for the same area cluster
- 20 dish + area pages
- 6 dish pages: Chicken Rice, Laksa, Char Kway Teow, Fish Soup, Yong Tau Foo, Satay
- 4 hawker-centre pages
- 3 mall / food-court pages
- 5 guide pages covering first-timer, halal, vegetarian, budget, and late-night discovery intents

## 3. Pages Noindexed Or Skipped

- No thin SEO pages were added to the sitemap.
- `/stalls/[stallSlug]` has no generated params because public stall pages need source-backed stall detail data before indexing.
- Ratings, review counts, opening hours, open-now status, and verification labels are omitted until visible source-backed data exists.

## 4. Structured Data Helpers Added

- `buildOrganizationSchema()`
- `buildWebsiteSchema()`
- `buildSoftwareApplicationSchema()`
- `buildLocalBusinessSchema()`
- `buildFoodEstablishmentSchema()`
- `buildRestaurantSchema()`
- `buildBreadcrumbSchema()`
- `buildItemListSchema()`
- `buildArticleSchema()`
- `buildFAQSchema()`
- `buildProfilePageSchema()`

Page-level JSON-LD uses BreadcrumbList, ItemList, Article, FAQPage, and FoodEstablishment where visible content supports the facts.

## 5. Sitemap And Robots Status

- `src/app/sitemap.ts` now reads the expanded `publicRoutes` registry and filters `noindex` routes.
- `src/app/robots.ts` allows public SEO pages and blocks `/api/`, `/console/`, `/merchant/`, and `/_next/`.
- `public/llms.txt` and `public/llms-full.txt` now reference the Singapore hub, priority area pages, dish pages, and guide pages.

## 6. Validation Scripts Added

- `npm run seo:validate`
- `npm run seo:sitemap`
- `npm run seo:structured-data`

## 7. Commands Run

- `npx tsc --noEmit` — pass
- `npm run lint` — pass
- `npm run seo:validate` — pass
- `npm run seo:sitemap` — pass
- `npm run seo:structured-data` — pass
- `npm run build:webpack` — pass after escalated rerun allowed network access for Google Fonts

Note: the first sandboxed `build:webpack` attempt failed because `next/font` could not resolve `fonts.googleapis.com` under restricted network access. The escalated build passed and generated 105 static pages.

## 8. Remaining Blockers

- Wire public stall pages to reliable source-backed stall detail data before indexing `/stalls/[stallSlug]`.
- Connect live menu prices, hours, reviews, and verification data before emitting those facts in copy or schema.
- Submit the sitemap in Google Search Console and Bing Webmaster Tools.
- Run Rich Results validation against deployed URLs.
- Monitor AI/search crawler logs after deployment.
- Run manual AI citation tests in ChatGPT, Claude, Gemini, Perplexity, and Bing Copilot after deployment.

## 9. Recommended Next Content Cluster

Next safe cluster:

- Clementi
- Toa Payoh
- Ang Mo Kio
- Paya Lebar
- Bishan
- Novena
- HarbourFront
- City Hall
- Little India
- Katong / Joo Chiat

Only create indexable pages when each area has visible place context, related dish context, internal links, FAQ content, and a source/freshness label.
