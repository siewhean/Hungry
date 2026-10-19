// Supabase has no "account created" auth event. A brand-new account's first
// session is signed in within moments of the account being confirmed (email
// link, auto-confirm) or created (OAuth), so a SIGNED_IN whose last_sign_in_at
// sits next to confirmed_at/created_at is that account's first sign-in.
const FIRST_SIGN_IN_WINDOW_MS = 2 * 60 * 1000;

export interface AuthUserTimestamps {
  created_at?: string | null;
  confirmed_at?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  app_metadata?: { provider?: unknown } | null;
}

function toTime(value?: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function isFirstSignIn(user: AuthUserTimestamps): boolean {
  const lastSignIn = toTime(user.last_sign_in_at);
  if (lastSignIn === null) return false;
  const anchor =
    toTime(user.confirmed_at) ?? toTime(user.email_confirmed_at) ?? toTime(user.created_at);
  if (anchor === null) return false;
  return Math.abs(lastSignIn - anchor) <= FIRST_SIGN_IN_WINDOW_MS;
}

export function getAuthUserProvider(user: AuthUserTimestamps): string {
  const provider = user.app_metadata?.provider;
  return typeof provider === "string" && provider ? provider : "email";
}
