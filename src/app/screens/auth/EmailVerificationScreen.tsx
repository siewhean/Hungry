import { useEffect, useRef, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { ArrowLeft, CircleAlert, MailCheck } from "lucide-react-native";

import { AppText, Button, FeedErrorBoundary } from "@/components/ui";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import { clearPendingSignUp, getPendingSignUp } from "@/features/auth/pendingSignUp";
import { clearShareAttribution, getShareAttribution } from "@/features/share/shareAttribution";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { Session } from "@/lib/services/types";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "EmailVerification">;

export function EmailVerificationScreen({ navigation, route }: Props) {
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const isSupabaseMode = getConfiguredDataSource() === "supabase";
  const confirmationCode = route.params?.code;
  const confirmationError = route.params?.error;
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const pending = getPendingSignUp(route.params?.email);
  const email = route.params?.email ?? pending?.email ?? "";
  const shouldCompleteOnboarding =
    route.params?.completedOnboarding ?? pending?.completedOnboarding ?? hasCompletedOnboarding;
  const [resendSeconds, setResendSeconds] = useState(email ? 54 : 0);
  const [isConfirming, setIsConfirming] = useState(false);
  const handledConfirmationCode = useRef<string | undefined>(undefined);

  const finishVerifiedSignIn = async (session: Session | null) => {
    if (isSupabaseMode) {
      if (!session) return false;
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
      if (migration.status === "failed") return false;
    }
    clearPendingSignUp();
    const shareAttribution = getShareAttribution();
    trackAnalyticsEvent("sign_up_completed", {
      method: "email",
      ...(shareAttribution
        ? { share_source: shareAttribution.source, share_route: shareAttribution.route }
        : {}),
    });
    if (shareAttribution) clearShareAttribution();
    completeAuth({
      authProvider: "email",
      completedOnboarding: shouldCompleteOnboarding,
      trackSignInEvent: false,
    });
    if (shouldCompleteOnboarding) {
      completeOnboarding();
    }
    showToast({
      message: shouldCompleteOnboarding
        ? "Email verified. Welcome to Hungry."
        : "Email verified. Continue onboarding.",
      tone: "success",
    });
    return true;
  };

  const sendToLogin = (message: string) => {
    showToast({ message, tone: "info" });
    navigation.navigate("Login");
  };

  // "I verified": Supabase confirmation happens in the browser and does not
  // create a session in the app, so retry sign-in with the in-memory sign-up
  // credentials. Without them (app restarted) the user signs in on Login.
  const handleVerifiedPress = async () => {
    if (isConfirming) return;
    if (!isSupabaseMode) {
      await finishVerifiedSignIn(null);
      return;
    }
    const credentials = getPendingSignUp(email);
    if (!credentials) {
      sendToLogin("If you've confirmed your email, sign in with your email and password.");
      return;
    }
    setIsConfirming(true);
    try {
      const session = await getHungryService().auth.signIn(credentials.email, credentials.password);
      await finishVerifiedSignIn(session);
    } catch (err) {
      const code =
        (err as { error_code?: string; code?: string })?.error_code ??
        (err as { error_code?: string; code?: string })?.code;
      showToast({
        message:
          code === "email_not_confirmed"
            ? "Your email isn't confirmed yet. Open the link in your inbox, then try again."
            : "Could not confirm verification yet. Please try again.",
        tone: "warning",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  // hungry://auth/confirm?code=… — exchange the PKCE code to sign in. The email
  // is already confirmed server-side before the redirect, so if the exchange
  // fails (e.g. link opened on another device) fall back to credential sign-in.
  useEffect(() => {
    if (!isSupabaseMode) return;
    if (confirmationError) {
      showToast({
        message:
          confirmationError === "expired"
            ? "That verification link has expired. Resend a new one or sign in."
            : "That verification link is invalid. Resend a new one or sign in.",
        tone: "error",
      });
      return;
    }
    if (!confirmationCode || handledConfirmationCode.current === confirmationCode) return;
    handledConfirmationCode.current = confirmationCode;
    setIsConfirming(true);
    void (async () => {
      try {
        const session = await getHungryService().auth.confirmEmail(confirmationCode);
        if (await finishVerifiedSignIn(session)) return;
      } catch {
        // Fall through to credential sign-in or Login.
      } finally {
        setIsConfirming(false);
      }
      if (getPendingSignUp(email)) {
        await handleVerifiedPress();
        return;
      }
      sendToLogin("Email confirmed. Sign in to continue.");
    })();
    // Runs once per confirmation code; handlers read current values.
  }, [confirmationCode, confirmationError, isSupabaseMode]);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const handleResend = async () => {
    if (resendSeconds > 0 || !email) {
      return;
    }
    try {
      if (isSupabaseMode) {
        await getHungryService().auth.resendVerificationEmail(email);
      } else {
        showToast({
          message: "Verification email resend is currently unavailable. Please try again shortly.",
          tone: "warning",
        });
        setResendSeconds(54);
        return;
      }
      showToast({
        message: `Verification email resent to ${email}.`,
        tone: "success",
      });
      setResendSeconds(54);
    } catch {
      showToast({
        message: "Could not resend verification email. Please try again shortly.",
        tone: "error",
      });
    }
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
        subtitle="Open the verification link in your inbox, then continue onboarding."
        footer={
          <Pressable
            onPress={() => navigation.navigate("SignUp")}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
            }}
          >
            <ArrowLeft color={palette.text} size={14} />
            <AppText tone="accent" style={{ fontWeight: "700" }}>
              Back to sign up
            </AppText>
          </Pressable>
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
          {email ? (
            <AppText tone="secondary" style={{ lineHeight: 24, textAlign: "center" }}>
              We sent a verification email to{" "}
              <AppText style={{ fontWeight: "700" }}>{email}</AppText>.
            </AppText>
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
              accessibilityState={{ disabled: resendSeconds > 0 }}
              disabled={resendSeconds > 0}
              onPress={() => {
                void handleResend();
              }}
              style={{ opacity: resendSeconds > 0 ? 0.8 : 1 }}
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
              label="I Verified My Email"
              loading={isConfirming}
              onPress={() => {
                void handleVerifiedPress();
              }}
              style={{ borderRadius: radii.pill, minHeight: 56 }}
            />
            <Button
              label="Change Email Address"
              variant="secondary"
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
              Hungry checks this email before saving protected account actions.
            </AppText>
          </View>
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
