import { useCallback, useEffect, useRef, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";

import { AppText, FeedErrorBoundary, AppSymbol } from "@/components/ui";
import {
  trackAuthFailed,
  trackAuthScreenViewed,
  trackEmailVerified,
  trackVerificationEmailResent,
} from "@/features/auth/authAnalytics";
import {
  AUTH_EMAIL_RATE_LIMITED_MESSAGE,
  getAuthErrorCode,
  getAuthFailureMessage,
  isUnexpectedAuthError,
} from "@/features/auth/authErrors";
import { completeVerifiedSignUp } from "@/features/auth/completeVerifiedSignUp";
import { beginSignUpConfirmation, endSignUpConfirmation } from "@/features/auth/firstSignIn";
import { EmailCodeField } from "@/features/auth/EmailCodeField";
import { formatCooldown, useResendCooldown } from "@/features/auth/useResendCooldown";
import {
  rememberPendingEmailVerification,
  takePendingEmailVerificationCompletesOnboarding,
} from "@/features/auth/pendingEmailVerification";
import { useSignedInProfileSync } from "@/features/auth/useSignedInProfileSync";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Session } from "@/lib/services/types";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";
import { AuthTextLink } from "./AuthTextLink";
import { ProfileSyncFailureBanner } from "./ProfileSyncFailureBanner";
import { AUTH_COPY } from "./authCopy";

type Props = NativeStackScreenProps<AuthStackParamList, "EmailVerification">;

export function EmailVerificationScreen({ navigation, route }: Props) {
  const showToast = useUIStore((state) => state.showToast);
  const { palette, radii, spacing } = useHungryTheme();
  const isSupabaseMode = getConfiguredDataSource() === "supabase";
  // The address the account uses (the sign-up form sends it as typed, with its capitals).
  const email = route.params?.email?.trim().toLowerCase() || undefined;
  const confirmationCode = route.params?.code;
  // Supabase redirects with ?error= when the link expired or was already used.
  const confirmationError = route.params?.error;
  // Only a sign-up sets this; Login's "Enter the code" leaves it out and must not reset it.
  const completedOnboarding = route.params?.completedOnboarding;
  // The sign-up that opened this screen just sent an email, so the wait starts now.
  const { seconds: resendSeconds, restart: restartResendCooldown } = useResendCooldown(true);
  const [isResending, setIsResending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const exchangedCode = useRef<string | null>(null);
  const profileSync = useSignedInProfileSync("email_verification");
  const { apply: applyProfile } = profileSync;

  useEffect(() => {
    trackAuthScreenViewed("email_verification");
  }, []);

  // The confirmation link reopens this screen with only `?code=` (often after a
  // cold start), so each sign-up that opens it records whether it had already
  // finished onboarding. Sign-up always passes the flag; Login's code path passes none.
  useEffect(() => {
    if (email && completedOnboarding !== undefined) {
      rememberPendingEmailVerification(completedOnboarding);
    }
  }, [completedOnboarding, email]);

  useEffect(() => {
    if (!confirmationError) return;
    showToast({
      message:
        confirmationError === "expired"
          ? "That verification link has expired. Resend a new one or sign in."
          : "That verification link is invalid. Resend a new one or sign in.",
      tone: "error",
    });
  }, [confirmationError, showToast]);

  // Signs the verified account in. RootNavigator then routes to onboarding or Home. The screen
  // change is the confirmation, so there is no success toast; a failed profile sync stays on
  // screen with a retry.
  const finishVerifiedSession = useCallback(
    async (session: Session) => {
      const shouldCompleteOnboarding = await takePendingEmailVerificationCompletesOnboarding();
      await applyProfile(session, {
        onSyncWarning: () => {
          showToast({
            message:
              "Email verified, but your taste profile could not sync. Try updating it again later.",
            tone: "warning",
          });
        },
        onSynced: () => completeVerifiedSignUp(shouldCompleteOnboarding),
      });
    },
    [applyProfile, showToast],
  );

  // Exchanges the confirmation link's code (or, in mock mode, simulates the link).
  const confirm = useCallback(
    async (code: string) => {
      setIsConfirming(true);
      try {
        beginSignUpConfirmation(null);
        const session = await getHungryService()
          .auth.confirmEmail(code)
          .finally(endSignUpConfirmation);
        trackEmailVerified("link");
        await finishVerifiedSession(session);
      } catch (error) {
        trackAuthFailed("email_confirm", "email", error, "email_verification");
        if (isUnexpectedAuthError(error)) reportError(error, { flow: "email_confirm_link" });
        showToast({
          message:
            "We couldn't finish verifying on this device. If you opened the link, sign in to continue.",
          tone: "warning",
        });
        navigation.navigate("Login");
      } finally {
        setIsConfirming(false);
      }
    },
    [finishVerifiedSession, navigation, showToast],
  );

  // The 8-digit code in the email works when the link was opened on another device.
  const confirmWithEmailCode = async (code: string) => {
    if (!email) return;
    try {
      beginSignUpConfirmation(email);
      const session = await getHungryService()
        .auth.verifyEmailCode(email, code, "signup")
        .finally(endSignUpConfirmation);
      if (!session) throw new Error("Email verified but no active session.");
      trackEmailVerified("code");
      await finishVerifiedSession(session);
    } catch (error) {
      trackAuthFailed("email_confirm", "email", error, "email_verification");
      if (isUnexpectedAuthError(error)) reportError(error, { flow: "email_confirm_code" });
      throw error;
    }
  };

  useEffect(() => {
    if (!confirmationCode || exchangedCode.current === confirmationCode) return;
    exchangedCode.current = confirmationCode;
    void confirm(confirmationCode);
  }, [confirm, confirmationCode]);

  const handleResend = async () => {
    if (resendSeconds > 0 || isResending || !email) {
      return;
    }
    setIsResending(true);
    try {
      await getHungryService().auth.resendVerificationEmail(email);
      trackVerificationEmailResent();
      showToast({
        message: `Verification email resent to ${email}.`,
        tone: "success",
      });
      restartResendCooldown();
    } catch (error) {
      trackAuthFailed("email_confirm", "email", error, "email_verification");
      if (isUnexpectedAuthError(error)) reportError(error, { flow: "email_confirm_resend" });
      const code = getAuthErrorCode(error);
      const isRateLimited =
        code === "over_email_send_rate_limit" || (error as { status?: number })?.status === 429;
      if (isRateLimited) {
        // Restart the wait instead of leaving a button that keeps failing.
        restartResendCooldown();
      }
      showToast({
        message: isRateLimited
          ? AUTH_EMAIL_RATE_LIMITED_MESSAGE
          : getAuthFailureMessage(
              error,
              "Could not resend verification email. Please try again shortly.",
            ),
        tone: "error",
      });
    } finally {
      setIsResending(false);
    }
  };

  const cooldownText = formatCooldown(resendSeconds);

  return (
    <FeedErrorBoundary
      title="Verification unavailable"
      body="Couldn't load email verification right now. Please retry."
    >
      <AuthScreenShell
        title="Verify your email"
        subtitle="Tap the link in the email we sent you, or type the code from it below."
        compact
        onBack={() =>
          navigation.canGoBack() ? navigation.goBack() : navigation.navigate("SignUp")
        }
      >
        <View style={{ gap: spacing[4] }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: palette.orangeLight,
              borderRadius: radii.pill,
              width: 64,
              height: 64,
              justifyContent: "center",
              alignSelf: "center",
            }}
          >
            <AppSymbol name="emailSent" color={palette.orange} size={30} />
          </View>
          <AppText tone="secondary" style={{ lineHeight: 24, textAlign: "center" }}>
            {isConfirming ? (
              "Confirming your email…"
            ) : email ? (
              <>
                We sent a verification email to{" "}
                <AppText style={{ fontWeight: "700" }}>{email}</AppText>.
              </>
            ) : (
              "Check your inbox for the verification email."
            )}
          </AppText>

          {profileSync.failed ? (
            <ProfileSyncFailureBanner
              onRetry={() => void profileSync.retry()}
              retrying={profileSync.isRetrying}
            />
          ) : null}

          {email && !isConfirming ? (
            <EmailCodeField
              screen="email_verification"
              onSubmit={confirmWithEmailCode}
              submitLabel="Verify email"
            />
          ) : null}

          {email ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                resendSeconds > 0
                  ? `Resend verification email available in ${cooldownText}`
                  : "Resend verification email"
              }
              accessibilityHint="Requests a new verification email"
              accessibilityState={{ disabled: resendSeconds > 0 || isResending }}
              disabled={resendSeconds > 0 || isResending}
              onPress={() => {
                void handleResend();
              }}
              style={{
                justifyContent: "center",
                minHeight: 44,
                opacity: resendSeconds > 0 ? 0.8 : 1,
              }}
            >
              <AppText style={{ color: palette.textSecondary, textAlign: "center" }}>
                Didn&apos;t receive the email?{" "}
                <AppText style={{ color: palette.accentText, fontWeight: "700" }}>
                  {resendSeconds > 0 ? `Resend in ${cooldownText}` : "Resend now"}
                </AppText>
              </AppText>
            </Pressable>
          ) : null}

          {/* The code field's "Verify email" is the one primary action; the rest are links. */}
          <View style={{ alignItems: "center", gap: spacing[1] }}>
            {!isSupabaseMode ? (
              // Mock mode has no email: this stands in for tapping the link.
              <AuthTextLink
                label="I've confirmed my email"
                disabled={isConfirming}
                onPress={() => void confirm("mock-confirmation")}
              />
            ) : null}
            <AuthTextLink
              label={AUTH_COPY.emailCode.wrongEmail}
              disabled={isConfirming}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                  return;
                }
                navigation.navigate("SignUp");
              }}
            />
          </View>

          {/* An address that already has an account gets no email (Supabase answers the same
              either way), so the code box would wait forever: point to sign in. The row wraps
              as one unit; Login carries the email and has Forgot password. */}
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <AppText tone="secondary">Already have an account? </AppText>
            <AuthTextLink
              label="Sign in"
              bold
              onPress={() => navigation.navigate("Login", { email })}
            />
          </View>

          <AppText variant="bodySmall" tone="muted" style={{ textAlign: "center" }}>
            Opened the link on a computer? Your email is still confirmed. Just sign in here.
          </AppText>
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
