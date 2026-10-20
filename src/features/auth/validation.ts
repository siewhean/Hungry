const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Length is the only client rule; Supabase rejects leaked passwords (HIBP). */
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

export function validatePassword(value: string, minLength = MIN_PASSWORD_LENGTH): true | string {
  const required = validateRequired(value, "Password");
  if (required !== true) {
    return required;
  }

  if (value.length < minLength) {
    return `Password must be at least ${minLength} characters`;
  }

  return true;
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
