// Public web and support endpoints. usehungry.com is the live marketing site
// (Vercel); keep every in-app link on this host so safeLinking can allowlist it.
export const WEB_HOST = "usehungry.com";
export const WEB_BASE_URL = `https://${WEB_HOST}`;
export const SUPPORT_EMAIL = "usehungrysingapore@gmail.com";

export const WEB_LINKS = {
  help: `${WEB_BASE_URL}/contact`,
  privacy: `${WEB_BASE_URL}/privacy`,
  terms: `${WEB_BASE_URL}/terms`,
  accountDeletion: `${WEB_BASE_URL}/account/delete`,
} as const;

// Share links are usehungry.com URLs so they work in any chat app. With the
// app installed, iOS Universal Links / Android App Links open the matching
// screen in the app (see linking.ts); otherwise the website page is shown.
export function webShareUrl(
  kind: "dish" | "stall" | "post" | "portfolio" | "user" | "review",
  id: string,
): string {
  return `${WEB_BASE_URL}/${kind}/${encodeURIComponent(id)}`;
}

// Each Supabase email/OAuth flow returns to its own path so the app never
// mistakes a sign-up confirmation or OAuth return for a password reset.
// Every one must be on the Supabase Auth redirect allow-list.
export const AUTH_REDIRECTS = {
  emailConfirm: "hungry://auth/confirm",
  /** A signed-in user confirming a new sign-in email; never the sign-up path. */
  emailChange: "hungry://auth/email-change",
  passwordReset: "hungry://auth/reset",
  oauth: "hungry://auth/oauth",
} as const;
