import { useCallback, useEffect, useRef, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { CircleAlert, MailCheck } from "lucide-react-native";

import { AppText, Button, FeedErrorBoundary } from "@/components/ui";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import { trackAuthFailed, trackAuthScreenViewed } from "@/features/auth/authAnalytics";
import { completeVerifiedSignUp } from "@/features/auth/completeVerifiedSignUp";
import { EmailCodeField } from "@/features/auth/EmailCodeField";
import {
  rememberPendingEmailVerification,
  takePendingEmailVerificationCompletesOnboarding,
} from "@/features/auth/pendingEmailVerification";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Session } from "@/lib/services/types";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "EmailVerification">;

// Server limit is auth.email.max_frequency = 60s (supabase/config.toml); a few
// seconds of margin keeps the first "Resend now" from hitting the rate limit.
const RESEND_COOLDOWN_SECONDS = 65;

function secondsUntil(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

export function EmailVerificationScreen({ navigation, route }: Props) {
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const isSupabaseMode = getConfiguredDataSource() === "supabase";
  const email = route.params?.email;
  const confirmationCode = route.params?.code;
  const completedOnboarding = route.params?.completedOnboarding ?? false;
  // The countdown runs from an end time, so a backgrounded app or a slow timer
  // cannot make it finish before the server allows another email.
  const [resendEndsAt, setResendEndsAt] = useState(
    () => Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
  );
  const [resendSeconds, setResendSeconds] = useState(() => secondsUntil(resendEndsAt));
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
    setResendSeconds(secondsUntil(resendEndsAt));
    const timer = setInterval(() => {
      const remaining = secondsUntil(resendEndsAt);
      setResendSeconds(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendEndsAt]);

  // Signs the verified account in. RootNavigator then routes to onboarding or Home.
  const finishVerifiedSession = useCallback(
    async (session: Session) => {
      const shouldCompleteOnboarding = await takePendingEmailVerificationCompletesOnboarding();
      await applySignedInProfile(session.profile, {
        profileReady: session.profileReady,
        onSyncWarning: () => {
          showToast({
            message:
              "Email verified, but your taste profile could not sync. Try updating it again later.",
            tone: "warning",
          });
        },
      });
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
        const session = await getHungryService().auth.confirmEmail(code);
        await finishVerifiedSession(session);
      } catch (error) {
        trackAuthFailed("email_confirm", "email", error);
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
      const session = await getHungryService().auth.verifyEmailCode(email, code, "signup");
      if (!session) throw new Error("Email verified but no active session.");
      await finishVerifiedSession(session);
    } catch (error) {
      trackAuthFailed("email_confirm", "email", error);
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
      setResendEndsAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    } catch (error) {
      trackAuthFailed("email_confirm", "email", error);
      const code =
        (error as { error_code?: string; code?: string })?.error_code ??
        (error as { error_code?: string; code?: string })?.code;
      const isRateLimited =
        code === "over_email_send_rate_limit" || (error as { status?: number })?.status === 429;
      if (isRateLimited) {
        // Restart the wait instead of leaving a button that keeps failing.
        setResendEndsAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      }
      showToast({
        message: isRateLimited
          ? "You've requested a few emails already. Please wait a minute, then try again."
          : "Could not resend verification email. Please try again shortly.",
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
    navigation.navigate("Login");
  };

  const minuteText = Math.floor(resendSeconds / 60);
  const secondText = String(resendSeconds % 60).padStart(2, "0");

  return (
    <FeedErrorBoundary
      title="Verification unavailable"
      body="Couldn't load email verification right now. Please retry."
    >
      <AuthScreenShell
        title="Verify your email"
        subtitle="Tap the link in the email we sent you, or type the code from it below."
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
                  ? `Resend verification email available in ${minuteText}:${secondText}`
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
                  {resendSeconds > 0 ? `Resend in ${minuteText}:${secondText}` : "Resend now"}
                </AppText>
              </AppText>
            </Pressable>
          ) : null}

          <View style={{ gap: spacing[3] }}>
            <Button
              label="I've confirmed my email"
              onPress={handleConfirmed}
              loading={isConfirming}
              style={{ borderRadius: radii.pill, minHeight: 56 }}
            />
            <Button
              label="Change Email Address"
              variant="secondary"
              disabled={isConfirming}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                  return;
                }
                navigation.navigate("SignUp");
              }}
              style={{ borderRadius: radii.pill, minHeight: 56 }}
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
