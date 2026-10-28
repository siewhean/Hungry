export type MockAuthFailure = {
  reason:
    | "invalid_credentials"
    | "network_unavailable"
    | "email_taken"
    | "over_email_send_rate_limit";
  message: string;
};

export function getMockLoginFailure(email: string, password: string): MockAuthFailure | null {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (!normalizedEmail || !normalizedPassword) {
    return {
      reason: "invalid_credentials",
      message: "Enter both email and password.",
    };
  }

  if (normalizedEmail.includes("offline")) {
    return {
      reason: "network_unavailable",
      message: "Network unavailable. Check your connection and try again.",
    };
  }

  if (normalizedEmail.includes("fail") || normalizedPassword === "wrong-password") {
    return {
      reason: "invalid_credentials",
      message: "Incorrect email or password.",
    };
  }

  return null;
}

export function getMockSignUpFailure(email: string): MockAuthFailure | null {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail.includes("offline")) {
    return {
      reason: "network_unavailable",
      message: "Network unavailable. Check your connection and try again.",
    };
  }

  if (normalizedEmail.includes("exists") || normalizedEmail.includes("taken")) {
    return {
      reason: "email_taken",
      message: "This email is already registered. Try signing in instead.",
    };
  }

  return null;
}

/** The one code the mock refuses, so the wrong-code state can be driven without a server. */
export const MOCK_WRONG_EMAIL_CODE = "00000000";

/** Sending a sign-in code: `offline` addresses have no network, `ratelimit` ones hit the email cap. */
export function getMockCodeSendFailure(
  email: string,
): (MockAuthFailure & { status?: number }) | null {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.includes("offline")) {
    return {
      reason: "network_unavailable",
      message: "Network unavailable. Check your connection and try again.",
    };
  }
  if (normalizedEmail.includes("ratelimit")) {
    return {
      reason: "over_email_send_rate_limit",
      message: "Email rate limit exceeded",
      status: 429,
    };
  }
  return null;
}
