# Hungry Legacy Marketing Site

Retired marketing landing site for Hungry, built with Next.js App Router in `marketing/web/`.

The active public website is `marketing/website/web-v2`. Do not deploy `marketing/web` for production traffic unless it is brought back under the current security, privacy, and release gates.

## What ships today

- `/` - legacy public landing page
- `/about` - static brand/context page
- `/for-merchants` - static merchant-facing page
- `/privacy` - static privacy page
- `/api/waitlist` - retired endpoint that returns HTTP 410 with `retired_surface`
- `app/layout.tsx` - site metadata, fonts, and global shell
- `components/` - canonical landing-page sections
- `app/_components/MarketingStaticPage.tsx` - shared static-page shell
- `public/og-image.svg` - social preview image used by metadata

Only the root `app/` and `components/` trees are canonical. The old mirrored `src/` tree has been retired.

## Tech

- Next.js 16.2.4
- React 19
- Tailwind CSS v4 via `app/globals.css`
- `next/font/google` with Nunito for headings/body and DM Mono for stats/metadata

## Local development

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Additional checks:

```bash
npm run lint
npm run build
```

## Structure

- `app/page.tsx` assembles the landing page
- `app/about/page.tsx`, `app/for-merchants/page.tsx`, and `app/privacy/page.tsx` provide the current static routes
- `components/*.tsx` contains section-level UI
- `app/_components/MarketingStaticPage.tsx` is the shared static-page template
- `app/api/waitlist/route.ts` holds the retired waitlist handler and must not use service-role credentials
- `public/` contains static assets such as the OG image
- `next.config.ts` defines app-level Next.js config, including the Turbopack root pin for this workspace

## Metadata and deployment notes

- Metadata defaults to `https://hungry.sg`
- Set `NEXT_PUBLIC_SITE_URL` if you need a different canonical/OG base URL for preview or staging deployments
- The OG asset is the checked-in SVG at `public/og-image.svg`
- Do not configure Supabase service-role keys for this legacy package. Waitlist writes and live counts belong to `marketing/website/web-v2`.

## Current gaps

- The legacy waitlist form is not connected. Use the active `marketing/website/web-v2` package for public waitlist collection.

## References

- Next.js metadata docs: https://nextjs.org/docs/app/getting-started/metadata-and-og-images
- Next.js Turbopack config docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack
