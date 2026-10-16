const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const DIGIT_REGEX = /\d/;
const SYMBOL_REGEX = /[^A-Za-z0-9]/;

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

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordRuleId = "length" | "uppercase" | "lowercase" | "number" | "special";

export type PasswordRule = {
  id: PasswordRuleId;
  /** Short checklist label shown up front under new-password fields. */
  label: string;
  /** Submit-time error returned by validatePassword when this rule fails. */
  error: string;
  test: (value: string) => boolean;
};

/**
 * Single source of truth for new-password rules. validatePassword and the
 * upfront requirements checklist both read this list so they never drift.
 */
export function getPasswordRules(minLength = PASSWORD_MIN_LENGTH): PasswordRule[] {
  return [
    {
      id: "length",
      label: `At least ${minLength} characters`,
      error: `Password must be at least ${minLength} characters`,
      test: (value) => value.length >= minLength,
    },
    {
      id: "uppercase",
      label: "One uppercase letter",
      error: "Password must include at least one uppercase letter",
      test: (value) => UPPERCASE_REGEX.test(value),
    },
    {
      id: "lowercase",
      label: "One lowercase letter",
      error: "Password must include at least one lowercase letter",
      test: (value) => LOWERCASE_REGEX.test(value),
    },
    {
      id: "number",
      label: "One number",
      error: "Password must include at least one number",
      test: (value) => DIGIT_REGEX.test(value),
    },
    {
      id: "special",
      label: "One special character",
      error: "Password must include at least one special character",
      test: (value) => SYMBOL_REGEX.test(value),
    },
  ];
}

export type PasswordRuleStatus = { id: PasswordRuleId; label: string; met: boolean };

export function getPasswordRuleStatuses(
  value: string,
  minLength = PASSWORD_MIN_LENGTH,
): PasswordRuleStatus[] {
  return getPasswordRules(minLength).map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(value),
  }));
}

export function validatePassword(value: string, minLength = PASSWORD_MIN_LENGTH): true | string {
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
