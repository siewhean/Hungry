export type MockAuthFailure = {
  reason: "invalid_credentials" | "network_unavailable" | "email_taken";
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
