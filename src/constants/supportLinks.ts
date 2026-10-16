/**
 * Public web + support destinations opened from the app.
 *
 * The live marketing site (marketing/website/web-v2, Vercel project
 * hungry-web-v2) is served at usehungry.com; hungry.sg does not resolve.
 * The site has /contact, /privacy, /terms and /account/delete routes and no
 * /help route, so help and support both go to /contact (which links
 * SUPPORT_EMAIL). Confirm the final domain/support inbox before launch.
 */
export const PUBLIC_SITE_ORIGIN = "https://usehungry.com";

export const SUPPORT_EMAIL = "hello@hungry.sg";

export const PUBLIC_LINKS = {
  support: `${PUBLIC_SITE_ORIGIN}/contact`,
  helpCenter: `${PUBLIC_SITE_ORIGIN}/contact`,
  privacy: `${PUBLIC_SITE_ORIGIN}/privacy`,
  terms: `${PUBLIC_SITE_ORIGIN}/terms`,
  accountDeletion: `${PUBLIC_SITE_ORIGIN}/account/delete`,
} as const;
