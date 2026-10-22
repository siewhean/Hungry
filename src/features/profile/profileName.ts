/** Matches the user_profiles_display_name_length check (20261022100200_profile_text_guards.sql). */
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 40;

const LOOKALIKE_LETTERS: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
};

/**
 * Mirrors app_private.is_reserved_display_name: names that could pass for the team.
 * Compared after lower-casing, mapping 0 1 3 4 5 to o i e a s and dropping spaces and symbols.
 */
export function isReservedDisplayName(name: string): boolean {
  const normalized = name
    .toLowerCase()
    .replace(/[01345]/g, (digit) => LOOKALIKE_LETTERS[digit] ?? digit)
    .replace(/[^a-z0-9]/g, "");
  return (
    /^(hungry|admin|administrator|official|support|staff|moderator|system|team)[0-9]*$/.test(
      normalized,
    ) ||
    /^hungry(team|official|support|admin|staff|hq|mod|moderator|app|care|help)[0-9]*$/.test(
      normalized,
    )
  );
}

/** The error to show for a display name, or undefined when it is fine to save. */
export function validateDisplayName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a display name.";
  if (trimmed.length > PROFILE_DISPLAY_NAME_MAX_LENGTH) {
    return `Use ${PROFILE_DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
  }
  if (isReservedDisplayName(trimmed)) return "That name is reserved. Please choose another.";
  return undefined;
}

/** Postgres check_violation (23514), which the profile text guards raise with a hint. */
export function isCheckViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "23514";
}

/** The hint the server attached to a refused name or bio, if any. */
export function profileTextRefusalHint(error: unknown): string | undefined {
  if (!isCheckViolation(error)) return undefined;
  const hint = (error as { hint?: unknown }).hint;
  return typeof hint === "string" ? hint : undefined;
}
