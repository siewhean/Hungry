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
    divider: "OR CONTINUE WITH",
    footerPrompt: "New to Hungry? ",
    footerAction: "Create account",
    continueAsGuest: "Continue without an account",
    successToast: "Welcome back.",
    providerSuccessToast: "Signed in successfully.",
    emailNotConfirmedToast: "Please verify your email before signing in.",
    invalidCredentialsToast: "Incorrect email or password.",
    genericErrorToast: "Sign in failed. Please try again.",
    providerCancelledToast: "Sign in was cancelled.",
    passwordValidationLabel: "Password",
  },
  signUp: {
    errorTitle: "Sign-up unavailable",
    errorBody: "Couldn't load account creation right now. Please retry.",
    title: "Create account",
    subtitle: "Join our community of food lovers.",
    displayNamePlaceholder: "Display name",
    emailPlaceholder: "Email address",
    passwordPlaceholder: "Create password",
    passwordRules:
      "Use at least 12 characters with an uppercase letter, a lowercase letter, a number and a symbol.",
    primaryButton: "Create account",
    divider: "OR REGISTER WITH EMAIL",
    footerPrompt: "Already have an account? ",
    footerAction: "Log in",
    termsPrefix: "By creating an account, you agree to Hungry's ",
    termsLabel: "Terms of Service",
    privacyJoiner: " and ",
    privacyLabel: "Privacy Policy",
    termsSuffix: ".",
    emailVerificationToast: "Account created. Please verify your email.",
    continueOnboardingToast: "Account created. Continue onboarding.",
    verificationUnavailableToast:
      "Verification email is currently unavailable. You can continue and verify later.",
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
    sentToast: "If the email exists, a reset link was sent.",
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

export function getAuthProviderUnavailableButtonLabel(provider: AuthProvider): string {
  return `${AUTH_PROVIDER_NAMES[provider]} unavailable`;
}

export function getAuthProviderUnavailableMessage(provider: AuthProvider): string {
  return `${AUTH_PROVIDER_NAMES[provider]} sign-in is not enabled in Supabase Auth.`;
}

export function getSignUpProviderSuccessMessage(provider: AuthProvider): string {
  return `Continue with ${AUTH_PROVIDER_NAMES[provider]} successful. Continue onboarding.`;
}
