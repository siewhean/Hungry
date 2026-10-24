// Supabase has no "account created" auth event, and a new user may confirm their email on
// a computer and first sign in on the phone hours later, so a clock window around
// confirmed_at is not a fact about the account. Instead the app writes
// user_metadata.onboarded_at once an account has finished first-run onboarding
// (markAccountOnboarded in the session store; the service stamps it on the auth user).
// A SIGNED_IN for an account without that stamp is a new account that still owes onboarding.
//
// Accounts created before the stamp existed carry none, so they count as existing: only
// accounts created on or after this date can be "new". It is when the code that writes the
// stamp landed on main (12993ef, 2026-10-19). It must never be in the future: a future date
// makes every account created until then "existing", which skips onboarding and logs the
// sign-up as sign_in_completed. The app has no public release yet, so no account created
// since then comes from a build that cannot write the stamp.
export const ONBOARDED_STAMP_STARTS_AT = Date.parse("2026-10-19T11:48:17Z");

// Confirming a sign-up email (code or link) is the one sign-in that is always a new
// account, whatever its created_at says. EmailVerification sets this around the call, and
// the SIGNED_IN that supabase-js raises inside it reads it, so the first event is already
// sign_up_completed and onboarding is not skipped.
let signUpConfirmationEmail: string | null | undefined;

export function beginSignUpConfirmation(email?: string | null): void {
  signUpConfirmationEmail = email?.trim().toLowerCase() ?? null;
}

export function endSignUpConfirmation(): void {
  signUpConfirmationEmail = undefined;
}

function isConfirmingSignUpFor(email?: string | null): boolean {
  if (signUpConfirmationEmail === undefined) return false;
  // A link exchange does not know the address; a code check must match it.
  return (
    signUpConfirmationEmail === null || signUpConfirmationEmail === email?.trim().toLowerCase()
  );
}

export interface AuthUserTimestamps {
  email?: string | null;
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
  if (isConfirmingSignUpFor(user.email)) return true;
  const createdAt = toTime(user.created_at);
  return createdAt !== null && createdAt >= ONBOARDED_STAMP_STARTS_AT;
}

export function getAuthUserProvider(user: AuthUserTimestamps): string {
  const provider = user.app_metadata?.provider;
  return typeof provider === "string" && provider ? provider : "email";
}
