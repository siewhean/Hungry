# Hungry Marketing Site

Marketing landing site for Hungry, built with Next.js App Router in `marketing/web/`.

## What ships today

- `/` - the public landing page and waitlist CTA flow
- `/about` - static brand/context page
- `/for-merchants` - static merchant-facing page
- `/privacy` - static privacy page
- `/api/waitlist` - Supabase-backed waitlist endpoint used by the form (`POST` submit, `GET` count/health)
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
- `app/api/waitlist/route.ts` holds the current Supabase-backed waitlist handler
- `public/` contains static assets such as the OG image
- `next.config.ts` defines app-level Next.js config, including the Turbopack root pin for this workspace

## Metadata and deployment notes

- Metadata defaults to `https://hungry.sg`
- Set `NEXT_PUBLIC_SITE_URL` if you need a different canonical/OG base URL for preview or staging deployments
- The OG asset is the checked-in SVG at `public/og-image.svg`
- The waitlist endpoint writes to `public.website_waitlist_entries` when `NEXT_PUBLIC_SUPABASE_URL` plus a public Supabase key is configured. Set `SUPABASE_SERVICE_ROLE_KEY` or `HUNGRY_SUPABASE_SERVICE_ROLE_KEY` to allow idempotent upserts and live count reads.

## Current gaps

- Without a Supabase service-role key, `GET /api/waitlist` returns a configured health response but not a live count. Public `POST` submissions still use the anon/publishable key path when available.

## References

- Next.js metadata docs: https://nextjs.org/docs/app/getting-started/metadata-and-og-images
- Next.js Turbopack config docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack
