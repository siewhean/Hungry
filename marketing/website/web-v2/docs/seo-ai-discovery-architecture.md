# Hungry SEO And AI Discovery Architecture

## Executive Summary

Hungry cannot force ChatGPT, Claude, Gemini, Perplexity, Bing, or Google to recommend or cite the site. The controllable strategy is to make Hungry easy to crawl, easy to understand, and easy to cite: public SSR pages, canonical metadata, crawler access, sitemap freshness, structured data, concise answer-style content, and measurement loops.

This document defines the architecture for `marketing/website/web-v2` and the testing approach for search-engine optimization, AI answer-engine discovery, and future content expansion.

## Current State

Implemented in this pass:

- Canonical metadata source: `src/app/seo.ts`
- Metadata base, title template, Open Graph, Twitter cards, robots metadata: `src/app/layout.tsx`
- Global JSON-LD for `Organization`, `WebSite`, and `MobileApplication`
- Generated crawler policy: `src/app/robots.ts`
- Generated sitemap: `src/app/sitemap.ts`
- LLM context files: `public/llms.txt` and `public/llms-full.txt`
- Local readiness check: `npm run seo:audit`

Implemented in the 2026-06-07 expansion:

- Singapore hub: `/singapore`
- Area pages: `/singapore/[area]/food`
- MRT pages: `/singapore/mrt/[station]/food`
- Dish pages: `/dishes/[dishSlug]`
- Dish + area pages: `/singapore/[area]/[dish]`
- Hawker-centre pages: `/hawker-centres/[centreSlug]`
- Mall food pages: `/malls/[mallSlug]/food`
- Guide pages: `/guides/[guideSlug]` and `/singapore/[guideSlug]`
- Dedicated sitemap and structured-data validation scripts

Known next opportunity:

- Wire source-backed public stall pages before indexing `/stalls/[stallSlug]`.
- Add dedicated topic pages for high-intent queries such as "Singapore food discovery app", "hawker food discovery Singapore", "food app for hawker stalls", and "food business discovery Singapore".

## Architecture

### 1. Crawl And Index Layer

Goal: let search and AI retrieval crawlers access the important public pages reliably.

Required surfaces:

- Public pages return `200`.
- Critical text is present in HTML, not only images or client-only UI.
- `robots.txt` allows public crawling and references the sitemap.
- `sitemap.xml` lists canonical public URLs.
- Each page has canonical metadata, title, description, Open Graph, and Twitter metadata.
- Production domain is controlled by `NEXT_PUBLIC_SITE_URL`.

Crawler policy:

- Allow normal search crawlers: `Googlebot`, `Bingbot`.
- Allow AI retrieval/search crawlers: `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`.
- Allow user-triggered agents where named: `ChatGPT-User`, `Claude-User`, `Perplexity-User`.
- Treat robots rules for user-triggered agents as best-effort crawler guidance, not guaranteed access control. Some user-triggered fetches may not behave like normal crawler indexing, so deployment should also avoid WAF blocks and use official IP verification or allowlisting when the hosting/security layer supports it.
- Allow training/AI-product crawlers on public marketing pages: `GPTBot`, `ClaudeBot`, `Google-Extended`.

### 2. Semantic Entity Layer

Goal: help search systems and AI systems identify Hungry as a Singapore food-discovery product.

Current JSON-LD:

- `Organization`: Hungry as the publisher/company entity.
- `WebSite`: usehungry.com as the canonical website.
- `MobileApplication`: Hungry as a coming-soon iOS/Android food discovery app.

Future JSON-LD:

- `FAQPage` only where FAQ content is visibly present on the page.
- `BreadcrumbList` once deeper topic and guide pages exist.
- `Article` or `BlogPosting` for food guides and launch updates.
- `LocalBusiness`, `Restaurant`, or menu-related schema only when public business profile pages exist and the visible page content supports it.

### 3. AI Answer Content Layer

Goal: make Hungry easy for answer engines to summarize accurately.

Content rules:

- Use direct H2/H3 questions and concise answer paragraphs.
- Put key facts in text, not only screenshots.
- State what Hungry is and is not.
- Prefer concrete Singapore context: hawker stalls, kopitiams, food courts, restaurants, cafes, bakeries, and home-based food businesses.
- Keep launch status explicit: coming soon / waitlist unless app-store links are live.
- Use source-like pages that can be cited: product explainer, foodie page, merchant page, privacy, terms, account deletion.

`llms.txt` policy:

- Keep `/llms.txt` as a concise map for LLM tools that choose to read it.
- Keep `/llms-full.txt` as a longer canonical description and Q&A context file.
- Do not treat `llms.txt` as a ranking factor or substitute for sitemap, metadata, structured data, and crawlable content.

### 4. Authority And Trust Layer

Goal: make Hungry worth citing, not merely crawlable.

Priority content:

- Clear product explanation: "dish-first food discovery app for Singapore".
- Merchant-specific explanation: how local food businesses can get discovered.
- Foodie-specific explanation: how users decide what to eat.
- Transparent contact, privacy, terms, and account-deletion pages.
- Original Singapore food-discovery insights once the content engine begins.

Trust guardrails:

- Do not claim the app is launched until app-store links exist.
- Do not call Hungry a delivery or booking platform.
- Do not make unverifiable traffic, ranking, merchant-growth, or AI-citation guarantees.

### 5. Measurement Layer

Goal: prove whether the strategy is working and find the next bottleneck.

Recommended tools:

- Google Search Console: indexing, crawl stats, performance, URL inspection.
- Bing Webmaster Tools: indexing, sitemap submission, and AI search reporting where available.
- Server or edge logs: crawler hits by user agent.
- Rich Results Test / schema validator: structured-data eligibility checks.
- Lighthouse or equivalent: SEO and performance checks.
- Prompt/citation audit: monthly manual checks in ChatGPT, Claude, Gemini, Perplexity, and Bing Copilot.

Tracked metrics:

- Indexed URLs.
- Sitemap fetch status.
- Search impressions/clicks by query.
- AI referral traffic when detectable.
- Crawler visits from Googlebot, Bingbot, OAI-SearchBot, GPTBot, ClaudeBot, Claude-SearchBot, PerplexityBot, and Google-Extended.
- Branded-query answer accuracy.
- Non-branded topic-query visibility.

## Implementation Roadmap

### P0 - Foundation

Status: implemented in `web-v2`.

- Add metadata base, canonical metadata, Open Graph, Twitter metadata.
- Add global JSON-LD for Hungry.
- Add `robots.ts`.
- Add `sitemap.ts`.
- Add `/llms.txt` and `/llms-full.txt`.
- Add `npm run seo:audit`.

### P1 - Content Expansion

Status: partially implemented for Singapore-first discovery pages.

Added:

- 10 area pages
- 10 MRT food pages
- 20 dish + area pages
- 6 dish pages
- 4 hawker-centre pages
- 3 mall food pages
- 5 guide/dietary/budget/late-night pages

Next, add static pages for the highest-intent product/category queries:

- `/singapore-food-discovery-app`
- `/hawker-food-discovery-singapore`
- `/for-hawker-stalls`
- `/for-home-based-food-businesses`
- `/food-business-discovery-singapore`

Each page should include:

- One clear search-intent H1.
- Direct answer block near the top.
- Singapore-specific examples.
- Internal links to `/for-foodies` and `/for-merchants`.
- JSON-LD where visible content supports it.

### P2 - Entity And Guide Expansion

Add durable guides once there is enough original content:

- Dish-first discovery guide.
- Singapore hawker-stall visibility guide.
- Merchant profile and menu accuracy guide.
- Food discovery versus delivery/booking explainer.

### P3 - Live Measurement And Iteration

- Verify ownership in Google Search Console and Bing Webmaster Tools.
- Submit sitemap.
- Add IndexNow for faster Bing discovery when content changes frequently.
- Review crawler logs monthly.
- Review AI answer accuracy monthly.
- Adjust content based on real queries and citation gaps.

## Testing Plan

Local source checks:

```bash
cd marketing/website/web-v2
npm run seo:audit
npm run lint
npm run build:webpack
```

Rendered checks after deployment:

- `https://usehungry.com/robots.txt` returns `200` and lists the sitemap.
- `https://usehungry.com/sitemap.xml` returns `200` and lists canonical public pages.
- `https://usehungry.com/llms.txt` returns `200`.
- Page source for `/`, `/for-foodies`, and `/for-merchants` includes canonical metadata and JSON-LD.
- Rich Results Test can parse JSON-LD without critical errors.
- Google Search Console can inspect and request indexing for the main URLs.
- Bing Webmaster Tools can fetch the sitemap.

AI answer checks:

- Ask: "What is Hungry Singapore food discovery?"
- Ask: "Is Hungry a delivery app?"
- Ask: "What app helps Singapore foodies decide what to eat?"
- Ask: "How can Singapore hawker stalls get discovered online?"
- Ask: "What is dish-first food discovery?"

Pass criteria:

- Answers describe Hungry as a Singapore food discovery app.
- Answers do not describe Hungry as delivery, booking, or globally launched unless the website changes.
- When citations are shown, they point to `usehungry.com` pages.

## Source Notes

- Google Search Central: SEO starter guide, technical requirements, sitemaps, robots.txt, structured data, and AI features use the same crawl/index foundations.
- OpenAI crawler documentation: `OAI-SearchBot`, `GPTBot`, and `ChatGPT-User` have distinct purposes; robots can express policy, while user-triggered fetches and WAF behavior still need deployment-level monitoring.
- Anthropic crawler documentation: Claude crawlers include search, user-triggered, and training-related agents.
- Bing Webmaster and IndexNow documentation: sitemaps and IndexNow support faster discovery, but do not guarantee indexing.
- `llms.txt` is a public proposal for LLM-oriented context files, not an official ranking standard.

## Official References

- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/essentials/technical-requirements
- https://developers.google.com/search/docs/crawling-indexing/robots/intro
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
- https://platform.openai.com/docs/bots
- https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- https://docs.perplexity.ai/guides/bots
- https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a
- https://www.indexnow.org/documentation
- https://schema.org/
- https://llmstxt.org/
