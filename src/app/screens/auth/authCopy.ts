export type AuthProvider = "google" | "apple";
export type AuthProviderIntent = "signIn" | "continue";

export const AUTH_COPY = {
  login: {
    errorTitle: "Sign in unavailable",
    errorBody: "Couldn't load sign in right now. Please retry.",
    title: "Sign in to Hungry",
    emailLabel: "Email address",
    passwordLabel: "Password",
    forgotPasswordLink: "Forgot password?",
    primaryButton: "Sign in",
    divider: "or use email",
    footerPrompt: "New to Hungry? ",
    footerAction: "Create account",
    emailNotConfirmedToast: "Please verify your email before signing in.",
    verifyEmailAction: "Enter the code from the email",
    closeLabel: "Close sign in",
    invalidCredentialsToast: "Incorrect email or password.",
    genericErrorToast: "Sign in failed. Please try again.",
    accountUnavailableToast: "This account can't sign in right now. Please contact support.",
    providerCancelledToast: "Sign in was cancelled.",
    providerFailedToast: "Sign in couldn't be completed. Please try again.",
    passwordValidationLabel: "Password",
  },
  signUp: {
    errorTitle: "Sign-up unavailable",
    errorBody: "Couldn't load account creation right now. Please retry.",
    title: "Create account",
    subtitle: "Join our community of food lovers.",
    displayNameLabel: "Name shown on your reviews",
    displayNameHelper: "A nickname is fine. Other people see this name next to your reviews.",
    emailLabel: "Email address",
    passwordLabel: "Create password",
    passwordRules: "Use at least 10 characters. Avoid passwords you've used elsewhere.",
    termsLinkHint: "Opens the Terms of service in your browser",
    privacyLinkHint: "Opens the Privacy Policy in your browser",
    primaryButton: "Create account",
    divider: "or use email",
    footerPrompt: "Already have an account? ",
    footerAction: "Sign in",
    termsPrefix: "By creating an account, you agree to Hungry's",
    termsLabel: "Terms of service",
    privacyJoiner: "and",
    privacyLabel: "Privacy policy",
    emailTakenToast: "This email is already registered. Try signing in instead.",
    invalidEmailToast: "Please use a valid email address.",
    genericErrorToast: "Could not continue sign-up. Please try again.",
    providerCancelledToast: "Sign-up was cancelled.",
    displayNameValidationLabel: "Name",
  },
  emailCode: {
    emailLabel: "Email address",
    continueButton: "Continue",
    termsPrefix: "By continuing, you agree to Hungry's",
    sentTitle: "Check your email",
    sentBody: "We emailed an 8-digit code to {email}.",
    sentSpamHint: "Can't find it? Check your spam or promotions folder.",
    codeLabel: "Enter the code",
    verifyButton: "Continue",
    wrongEmail: "Wrong email? Change it",
    usePassword: "Use a password instead",
    useCode: "Email me a code instead",
    sendFailed: "We couldn't send the code. Please try again.",
    syncFailed: "You're signed in, but we couldn't load your taste profile. Try again.",
    syncRetry: "Try again",
    syncWarning: "Signed in, but your taste profile could not sync. Try updating it later.",
    suggestionPrompt: "Did you mean",
    suggestionAccept: "Use this address",
    nameCounter: "{count}/{max}",
  },
  forgotPassword: {
    errorTitle: "Password recovery unavailable",
    errorBody: "Couldn't load password recovery right now. Please retry.",
    title: "Forgot password",
    subtitle: "Enter your email address and we'll send reset instructions.",
    sentShellTitle: "Check your inbox",
    emailLabel: "Email address",
    primaryButton: "Send reset link",
    backToLogin: "Back to sign in",
    sentBody:
      "If an account exists for {email}, we've sent a link and a code to reset your password. Open the link on this phone, or enter the code below.",
    sentSpamHint: "Can't find it? Check your spam or promotions folder.",
    resendButton: "Send again",
    resendInButton: "Send again in {time}",
    useDifferentEmail: "Use a different email",
    genericErrorToast: "Could not send reset link. Please try again.",
  },
} as const;

export const AUTH_PROVIDER_NAMES: Record<AuthProvider, string> = {
  google: "Google",
  apple: "Apple",
};

export function getAuthProviderButtonLabel(
  provider: AuthProvider,
  intent: AuthProviderIntent,
): string {
  const providerName = AUTH_PROVIDER_NAMES[provider];
  return intent === "signIn" ? `Sign in with ${providerName}` : `Continue with ${providerName}`;
}

export function getAuthProviderUnavailableMessage(provider: AuthProvider): string {
  return `${AUTH_PROVIDER_NAMES[provider]} sign-in isn't available right now. Use your email instead.`;
}

/**
 * Friendly copy for a failed Google/Apple sign-in. Raw OAuth errors (callback,
 * state, session) are reported for debugging and never shown to users.
 */
export function getProviderErrorMessage(
  error: unknown,
  provider: AuthProvider,
  copy: { cancelled: string; failed: string },
): string {
  const rawMessage = (error as { message?: string })?.message ?? "";
  const message = rawMessage.toLowerCase();
  if (message.includes("provider is not enabled")) {
    return getAuthProviderUnavailableMessage(provider);
  }
  if (message.includes("cancelled")) {
    return copy.cancelled;
  }
  if (typeof __DEV__ !== "undefined" && __DEV__ && rawMessage) {
    return rawMessage;
  }
  return copy.failed;
}
