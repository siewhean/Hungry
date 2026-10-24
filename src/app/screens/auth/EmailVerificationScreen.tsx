import { useCallback, useEffect, useRef, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { CircleAlert, MailCheck } from "lucide-react-native";

import { AppText, FeedErrorBoundary } from "@/components/ui";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import {
  trackAuthFailed,
  trackAuthScreenViewed,
  trackEmailVerified,
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
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Session } from "@/lib/services/types";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "EmailVerification">;

export function EmailVerificationScreen({ navigation, route }: Props) {
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const isSupabaseMode = getConfiguredDataSource() === "supabase";
  const email = route.params?.email;
  const confirmationCode = route.params?.code;
  // Supabase redirects with ?error= when the link expired or was already used.
  const confirmationError = route.params?.error;
  const completedOnboarding = route.params?.completedOnboarding ?? false;
  // The sign-up that opened this screen just sent an email, so the wait starts now.
  const { seconds: resendSeconds, restart: restartResendCooldown } = useResendCooldown(true);
  const [isResending, setIsResending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const exchangedCode = useRef<string | null>(null);

  useEffect(() => {
    trackAuthScreenViewed("email_verification");
  }, []);

  // The confirmation link reopens this screen with only `?code=` (often after a
  // cold start), so each sign-up that opens it records whether it had already
  // finished onboarding. A plain SignUp passes no flag and resets it to false.
  useEffect(() => {
    if (email) rememberPendingEmailVerification(completedOnboarding);
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

  // Signs the verified account in. RootNavigator then routes to onboarding or Home.
  const finishVerifiedSession = useCallback(
    async (session: Session) => {
      const shouldCompleteOnboarding = await takePendingEmailVerificationCompletesOnboarding();
      const migration = await applySignedInProfile(session.profile, {
        profileReady: session.profileReady,
        onSyncWarning: () => {
          showToast({
            message:
              "Email verified, but your taste profile could not sync. Try updating it again later.",
            tone: "warning",
          });
        },
      });
      if (migration.status === "failed") return;
      completeVerifiedSignUp(shouldCompleteOnboarding);
      showToast({ message: "Email verified. Welcome to Hungry.", tone: "success" });
    },
    [showToast],
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
        trackAuthFailed("email_confirm", "email", error);
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
      trackAuthFailed("email_confirm", "email", error);
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
      showToast({
        message: `Verification email resent to ${email}.`,
        tone: "success",
      });
      restartResendCooldown();
    } catch (error) {
      trackAuthFailed("email_confirm", "email", error);
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

  // A confirmation opened on another device or browser cannot be detected here,
  // so the honest next step is to sign in. Mock mode simulates tapping the link.
  const handleConfirmed = () => {
    if (!isSupabaseMode) {
      void confirm("mock-confirmation");
      return;
    }
    showToast({
      message: "Once you've tapped the link in the email, sign in to continue.",
      tone: "info",
    });
    navigation.navigate("Login", { email });
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
            <MailCheck color={palette.orange} size={30} />
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

          {email && !isConfirming ? (
            <EmailCodeField onSubmit={confirmWithEmailCode} submitLabel="Verify email" />
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
                <AppText style={{ color: palette.orange, fontWeight: "700" }}>
                  {resendSeconds > 0 ? `Resend in ${cooldownText}` : "Resend now"}
                </AppText>
              </AppText>
            </Pressable>
          ) : null}

          {/* The code field's "Verify email" is the one primary action; the rest are links. */}
          <View style={{ alignItems: "center", gap: spacing[1] }}>
            <TextLink
              label="I've confirmed my email"
              disabled={isConfirming}
              onPress={handleConfirmed}
            />
            <TextLink
              label="Change email address"
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
              either way), so the code box would wait forever: point to sign in and reset. */}
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <AppText tone="secondary">Already have an account? </AppText>
            <TextLink
              label="Sign in"
              bold
              onPress={() => navigation.navigate("Login", { email })}
            />
            <AppText tone="secondary"> · </AppText>
            <TextLink
              label="Reset password"
              bold
              onPress={() => navigation.navigate("ForgotPassword")}
            />
          </View>

          <View
            style={{
              backgroundColor: palette.infoSoft,
              borderRadius: componentRadii.card,
              flexDirection: "row",
              gap: spacing[3],
              padding: spacing[3],
            }}
          >
            <CircleAlert color={palette.orange} size={18} />
            <AppText variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
              Opened the link on a computer? Your email is still confirmed. Just sign in here.
            </AppText>
          </View>
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}

function TextLink({
  label,
  onPress,
  disabled = false,
  bold = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  bold?: boolean;
}) {
  const { spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={{ justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[2] }}
    >
      <AppText variant={bold ? "bodyBold" : "body"} tone="accent">
        {label}
      </AppText>
    </Pressable>
  );
}
