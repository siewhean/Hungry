// Supabase has no "account created" auth event, and a new user may confirm their email on
// a computer and first sign in on the phone hours later, so a clock window around
// confirmed_at is not a fact about the account. Instead the app writes
// user_metadata.onboarded_at once an account has finished first-run onboarding
// (markAccountOnboarded in the session store; the service stamps it on the auth user).
// A SIGNED_IN for an account without that stamp is a new account that still owes onboarding.
//
// Accounts created before the stamp existed carry none, so they count as existing: only
// accounts created on or after this date can be "new". Set it to the release date of the
// build that first writes the stamp.
export const ONBOARDED_STAMP_STARTS_AT = Date.parse("2026-11-01T00:00:00Z");

export interface AuthUserTimestamps {
  created_at?: string | null;
  user_metadata?: { onboarded_at?: unknown } | null;
  app_metadata?: { provider?: unknown } | null;
}

function toTime(value?: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function isNewAccount(user: AuthUserTimestamps): boolean {
  if (user.user_metadata?.onboarded_at) return false;
  const createdAt = toTime(user.created_at);
  return createdAt !== null && createdAt >= ONBOARDED_STAMP_STARTS_AT;
}

export function getAuthUserProvider(user: AuthUserTimestamps): string {
  const provider = user.app_metadata?.provider;
  return typeof provider === "string" && provider ? provider : "email";
}
