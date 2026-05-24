# Hungry Web V2

Next.js marketing site for Hungry, the Singapore dish-first food discovery app.

## Commands

```bash
npm run dev
npm run lint
npm run seo:audit
npm run build:webpack
```

## Public Routes

- `/`
- `/for-foodies`
- `/for-merchants`
- `/join-waitlist`
- `/privacy`
- `/terms`
- `/account/delete`

Route metadata is centralized in `src/app/seo.ts`. Keep sitemap routes, canonical metadata, and LLM context files aligned with that source.

## SEO And AI Discovery Surfaces

- `src/app/layout.tsx`: metadata base, default title template, Open Graph, Twitter, robots metadata, and global JSON-LD.
- `src/app/robots.ts`: public crawler policy for normal search crawlers and AI retrieval/training crawlers.
- `src/app/sitemap.ts`: generated XML sitemap from the canonical public route list.
- `src/components/seo/JsonLd.tsx`: JSON-LD script component.
- `public/llms.txt`: concise AI/LLM context map.
- `public/llms-full.txt`: expanded AI/LLM context and canonical wording.
- `scripts/seo-ai-readiness-check.mjs`: local guard for crawler files, structured data, AI crawler markers, and stale LLM routes.

## Environment

Set `NEXT_PUBLIC_SITE_URL` in production if the canonical domain changes. It defaults to `https://hungry.sg`.
