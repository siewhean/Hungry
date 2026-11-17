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

export function validatePassword(value: string, minLength = 12): true | string {
  const required = validateRequired(value, "Password");
  if (required !== true) {
    return required;
  }

  if (value.length < minLength) {
    return `Password must be at least ${minLength} characters`;
  }

  if (!UPPERCASE_REGEX.test(value)) {
    return "Password must include at least one uppercase letter";
  }

  if (!LOWERCASE_REGEX.test(value)) {
    return "Password must include at least one lowercase letter";
  }

  if (!DIGIT_REGEX.test(value)) {
    return "Password must include at least one number";
  }

  if (!SYMBOL_REGEX.test(value)) {
    return "Password must include at least one special character";
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
