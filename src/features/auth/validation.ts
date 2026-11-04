const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Length is the only client rule (also pinned in supabase/config.toml); Supabase rejects leaked passwords once HIBP protection is on in the dashboard. */
export const MIN_PASSWORD_LENGTH = 10;

/** iOS strong-password rules matching validatePassword, so suggested passwords pass. */
export const PASSWORD_RULES = `minlength: ${MIN_PASSWORD_LENGTH};`;

export const PASSWORD_REQUIREMENTS_COPY = `Use at least ${MIN_PASSWORD_LENGTH} characters. Avoid passwords you've used elsewhere.`;

export const WEAK_PASSWORD_MESSAGE =
  "That password has appeared in a data breach or is too easy to guess. Try a longer, less common one.";

/** True for Supabase's weak/leaked password rejection (code weak_password). */
export function isWeakPasswordError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === "weak_password") return true;
  return typeof message === "string" && /weak|pwned|leaked|breach/i.test(message);
}

/** User-facing copy for a rejected password update (Supabase AuthError codes). */
export function getPasswordUpdateErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === "same_password") {
    return "Your new password must be different from your current one.";
  }
  if (isWeakPasswordError(error)) {
    return WEAK_PASSWORD_MESSAGE;
  }
  return "Password reset failed. Please try again.";
}

export function validateRequired(value: string, label: string): true | string {
  if (value.trim().length > 0) {
    return true;
  }

  return `${label} is required`;
}

export function validateEmail(value: string): true | string {
  const required = validateRequired(value, "Email");
  if (required !== true) {
    return required;
  }

  if (!EMAIL_REGEX.test(value.trim())) {
    return "Enter a valid email address";
  }

  return true;
}

/** Kept for callers of the shared checklist; equals MIN_PASSWORD_LENGTH. */
export const PASSWORD_MIN_LENGTH = MIN_PASSWORD_LENGTH;

export type PasswordRuleId = "length";

export type PasswordRule = {
  id: PasswordRuleId;
  /** Short checklist label shown up front under new-password fields. */
  label: string;
  /** Submit-time error returned by validatePassword when this rule fails. */
  error: string;
  test: (value: string) => boolean;
};

/**
 * Single source of truth for new-password rules. Length is the only client rule
 * (Supabase rejects leaked passwords), and validatePassword plus the upfront
 * checklist both read this list so they never drift.
 */
export function getPasswordRules(minLength = MIN_PASSWORD_LENGTH): PasswordRule[] {
  return [
    {
      id: "length",
      label: `At least ${minLength} characters`,
      error: `Password must be at least ${minLength} characters`,
      test: (value) => value.length >= minLength,
    },
  ];
}

export type PasswordRuleStatus = { id: PasswordRuleId; label: string; met: boolean };

export function getPasswordRuleStatuses(
  value: string,
  minLength = MIN_PASSWORD_LENGTH,
): PasswordRuleStatus[] {
  return getPasswordRules(minLength).map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(value),
  }));
}

export function validatePassword(value: string, minLength = MIN_PASSWORD_LENGTH): true | string {
  const required = validateRequired(value, "Password");
  if (required !== true) {
    return required;
  }

  const failed = getPasswordRules(minLength).find((rule) => !rule.test(value));
  return failed ? failed.error : true;
}

export function validateConfirmPassword(password: string, confirmPassword: string): true | string {
  const required = validateRequired(confirmPassword, "Confirm password");
  if (required !== true) {
    return required;
  }

  if (password !== confirmPassword) {
    return "Passwords do not match";
  }

  return true;
}

/** The longest display name the server keeps (user_profiles_display_name_length). */
export const MAX_DISPLAY_NAME_LENGTH = 40;

/**
 * Mirror of app_private.is_reserved_display_name (supabase/migrations/
 * 20261022100200_profile_text_guards.sql): the same digit-to-letter map and the same pattern.
 * A contract test compares the two so they cannot drift. The server also holds a blocked-term
 * list it does not publish, so a name that passes here can still be refused there.
 */
export const RESERVED_DISPLAY_NAME_PATTERN =
  /^(hungry|admin|administrator|official|support|staff|moderator|system|team)[0-9]*$|^hungry(team|official|support|admin|staff|hq|mod|moderator|app|care|help)[0-9]*$/;

export function isReservedDisplayName(value: string): boolean {
  const folded = value
    .toLowerCase()
    .replace(/[01345]/g, (digit) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s" })[digit]!)
    .replace(/[^a-z0-9]/g, "");
  return RESERVED_DISPLAY_NAME_PATTERN.test(folded);
}

export const RESERVED_DISPLAY_NAME_MESSAGE = "That name is reserved. Please choose another.";

/** The name shown on reviews: required, at most 40 characters, not a reserved name. */
export function validateDisplayName(value: string, label = "Name"): true | string {
  const required = validateRequired(value, label);
  if (required !== true) return required;
  const name = value.trim();
  if (name.length > MAX_DISPLAY_NAME_LENGTH) {
    return `${label} can be up to ${MAX_DISPLAY_NAME_LENGTH} characters`;
  }
  if (isReservedDisplayName(name)) return RESERVED_DISPLAY_NAME_MESSAGE;
  return true;
}

/** Common mail providers, with the typos that reach them most often. */
const EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "singnet.com.sg",
  "u.nus.edu",
  "e.ntu.edu.sg",
  "nus.edu.sg",
  "ntu.edu.sg",
  "smu.edu.sg",
] as const;

/** Domains that are real addresses on their own and must never be "corrected". */
const KNOWN_OTHER_DOMAINS = new Set([
  "yahoo.com.sg",
  "yahoo.co.uk",
  "hotmail.co.uk",
  "hotmail.sg",
  "outlook.sg",
  "gmail.sg",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "qq.com",
  "163.com",
  "126.com",
  "example.com",
]);

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return row[right.length];
}

/**
 * "Did you mean …?" for an address whose domain is one typo away from a common provider
 * (`a@gmial.com` becomes `a@gmail.com`). Returns null when the address is valid as typed, the
 * domain is unknown, or it is too different to guess: a wrong suggestion is worse than none.
 */
export function suggestEmailDomain(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if ((EMAIL_DOMAINS as readonly string[]).includes(domain) || KNOWN_OTHER_DOMAINS.has(domain)) {
    return null;
  }
  // Only domains long enough for one slip to be a typo, not a different company.
  if (domain.length < 7) return null;
  let best: { domain: string; distance: number } | null = null;
  for (const candidate of EMAIL_DOMAINS) {
    const distance = editDistance(domain, candidate);
    if (distance <= 2 && (!best || distance < best.distance))
      best = { domain: candidate, distance };
  }
  // Distance 2 is allowed only for the long names where a transposition counts as two edits.
  if (!best || (best.distance === 2 && best.domain.length < 9)) return null;
  return `${local}@${best.domain}`;
}
