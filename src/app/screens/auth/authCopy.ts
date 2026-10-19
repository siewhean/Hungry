export type AuthProvider = "google" | "apple";
export type AuthProviderIntent = "signIn" | "continue";

export const AUTH_COPY = {
  login: {
    errorTitle: "Sign in unavailable",
    errorBody: "Couldn't load sign in right now. Please retry.",
    title: "Welcome back",
    emailPlaceholder: "Email address",
    passwordPlaceholder: "Password",
    forgotPasswordLink: "Forgot password?",
    primaryButton: "Sign in",
    divider: "OR USE EMAIL",
    footerPrompt: "New to Hungry? ",
    footerAction: "Create account",
    continueAsGuest: "Continue without an account",
    successToast: "Welcome back.",
    providerSuccessToast: "Signed in successfully.",
    emailNotConfirmedToast: "Please verify your email before signing in.",
    resendVerificationAction: "Resend verification email",
    resendVerificationSentToast: "Verification email sent. Check your inbox.",
    closeLabel: "Close sign in",
    invalidCredentialsToast: "Incorrect email or password.",
    genericErrorToast: "Sign in failed. Please try again.",
    providerCancelledToast: "Sign in was cancelled.",
    providerFailedToast: "Sign in couldn't be completed. Please try again.",
    passwordValidationLabel: "Password",
  },
  signUp: {
    errorTitle: "Sign-up unavailable",
    errorBody: "Couldn't load account creation right now. Please retry.",
    title: "Create account",
    subtitle: "Join our community of food lovers.",
    displayNamePlaceholder: "Full name",
    emailPlaceholder: "Email address",
    passwordPlaceholder: "Create password",
    passwordRules:
      "Use at least 12 characters with an uppercase letter, a lowercase letter, a number and a symbol.",
    termsLinkHint: "Opens the Terms of Service in your browser",
    privacyLinkHint: "Opens the Privacy Policy in your browser",
    primaryButton: "Create account",
    divider: "OR USE EMAIL",
    footerPrompt: "Already have an account? ",
    footerAction: "Log in",
    termsPrefix: "By creating an account, you agree to Hungry's",
    termsLabel: "Terms of Service",
    privacyJoiner: "and",
    privacyLabel: "Privacy Policy",
    emailVerificationToast: "Account created. Please verify your email.",
    continueOnboardingToast: "Account created. Continue onboarding.",
    tooManyAttemptsToast: "Too many attempts. Please wait a moment and try again.",
    invalidEmailToast: "Please use a valid email address.",
    genericErrorToast: "Could not continue sign-up. Please try again.",
    providerCancelledToast: "Sign-up was cancelled.",
    displayNameValidationLabel: "Display name",
  },
  forgotPassword: {
    errorTitle: "Password recovery unavailable",
    errorBody: "Couldn't load password recovery right now. Please retry.",
    title: "Forgot password",
    subtitle: "Enter your email address and we'll send reset instructions.",
    emailLabel: "EMAIL ADDRESS",
    emailPlaceholder: "Email address",
    primaryButton: "Send reset link",
    backToLogin: "Back to login",
    helperText: "We keep this flow secure and simple so you can return to dish discovery quickly.",
    sentTitle: "Check your inbox",
    sentBody:
      "If an account exists for {email}, we've sent a link to reset your password. Open it on this phone.",
    sentSpamHint: "Can't find it? Check your spam or promotions folder.",
    resendButton: "Send again",
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

export function getSignUpProviderSuccessMessage(provider: AuthProvider): string {
  return `Continue with ${AUTH_PROVIDER_NAMES[provider]} successful. Continue onboarding.`;
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
