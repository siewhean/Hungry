import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View, type TextInput } from "react-native";
import { ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";

import { AppText, Button, FeedErrorBoundary, InlineBanner, Input } from "@/components/ui";
import { trackAuthFailed, trackAuthScreenViewed } from "@/features/auth/authAnalytics";
import {
  getPasswordUpdateErrorMessage,
  PASSWORD_RULES,
  validateConfirmPassword,
  validatePassword,
} from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";
import { PasswordRequirements } from "./PasswordRequirements";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;
type FormValues = { password: string; confirmPassword: string };

const INVALID_LINK_MESSAGE =
  "This password reset link is invalid or has expired. Request a new link to continue.";
const EXPIRED_LINK_MESSAGE =
  "This password reset link has expired. Request a new link to continue.";

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { colorScheme, componentRadii, palette, spacing } = useHungryTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
  const isSupabaseMode = getConfiguredDataSource() === "supabase";
  const recoveryCode = route.params?.code ?? "";
  const [linkError, setLinkError] = useState<string | null>(() => {
    if (!isSupabaseMode) return null;
    if (route.params?.error === "expired") return EXPIRED_LINK_MESSAGE;
    if (route.params?.error || !recoveryCode) return INVALID_LINK_MESSAGE;
    return null;
  });
  const setPasswordRecoveryInProgress = useSessionStore(
    (state) => state.setPasswordRecoveryInProgress,
  );
  const confirmPasswordRef = useRef<TextInput>(null);
  // The reset link's code can be exchanged only once; a retry after a rejected
  // password must call updatePassword alone.
  const recoveryCodeExchangedRef = useRef(false);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { password: "", confirmPassword: "" },
  });
  const passwordValue = watch("password");

  useEffect(() => {
    trackAuthScreenViewed("reset_password");
  }, []);

  // Leaving the reset flow releases the hold so RootNavigator can route onward.
  useEffect(() => () => setPasswordRecoveryInProgress(false), [setPasswordRecoveryInProgress]);

  const handleReset = handleSubmit(async ({ password }) => {
    // Exchanging the recovery code signs the user in. Hold RootNavigator's
    // signed-in redirect until the new password is saved and confirmed on
    // ResetPasswordSuccess, which releases the hold.
    setPasswordRecoveryInProgress(true);
    if (isSupabaseMode) {
      const auth = getHungryService().auth;
      if (!recoveryCodeExchangedRef.current) {
        try {
          await auth.exchangeRecoveryCode(recoveryCode);
          recoveryCodeExchangedRef.current = true;
        } catch (error) {
          // No session was created, so nothing to hold.
          setPasswordRecoveryInProgress(false);
          setLinkError(INVALID_LINK_MESSAGE);
          trackAuthFailed("password_reset", "email", error);
          showToast({
            message: "This reset link has expired or was already used. Request a new one.",
            tone: "error",
          });
          return;
        }
      }
      try {
        await auth.updatePassword(password);
      } catch (error) {
        // The recovery session is signed in: keep the hold so the user stays
        // here and can retry with a different password.
        trackAuthFailed("password_reset", "email", error);
        showToast({ message: getPasswordUpdateErrorMessage(error), tone: "error" });
        return;
      }
    }
    navigation.navigate("ResetPasswordSuccess");
  });

  const leaveRecovery = (target: "Login" | "ForgotPassword") => {
    const session = useSessionStore.getState();
    // Abandoning after the code was exchanged must not leave a silent sign-in.
    if (recoveryCodeExchangedRef.current) session.signOut();
    setPasswordRecoveryInProgress(false);
    navigation.navigate(target);
  };

  return (
    <FeedErrorBoundary
      title="Reset unavailable"
      body="Couldn't load password reset right now. Please retry."
    >
      <AuthScreenShell
        title=""
        wordmarkColor={colorScheme === "dark" ? palette.white : palette.navy}
        footer={
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel="Back to Sign In"
            accessibilityHint="Returns to the sign in screen"
            onPress={() => leaveRecovery("Login")}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
            }}
          >
            <ArrowLeft color={palette.text} size={12} />
            <AppText tone="secondary" style={{ fontWeight: "600" }}>
              Back to Sign In
            </AppText>
          </Pressable>
        }
      >
        <View style={{ gap: spacing[4] }}>
          {linkError ? (
            <View style={{ gap: spacing[3] }}>
              <InlineBanner message={linkError} tone="error" />
              <Button
                label="Request a new link"
                variant="secondary"
                onPress={() => leaveRecovery("ForgotPassword")}
              />
            </View>
          ) : null}
          <Controller
            control={control}
            name="password"
            rules={{ validate: (value) => validatePassword(value) }}
            render={({ field: { onChange, value } }) => (
              <Input
                label="NEW PASSWORD"
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoComplete="new-password"
                passwordRules={PASSWORD_RULES}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                error={!!errors.password}
                errorText={errors.password?.message}
                rightIcon={
                  <Pressable
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    accessibilityHint={
                      showPassword
                        ? "Hides the password characters"
                        : "Shows the password characters"
                    }
                    onPress={() => setShowPassword((current) => !current)}
                    hitSlop={8}
                  >
                    {showPassword ? (
                      <EyeOff color={palette.textMuted} size={15} />
                    ) : (
                      <Eye color={palette.textMuted} size={15} />
                    )}
                  </Pressable>
                }
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            rules={{ validate: (value) => validateConfirmPassword(passwordValue ?? "", value) }}
            render={({ field: { onChange, value } }) => (
              <Input
                ref={confirmPasswordRef}
                label="CONFIRM NEW PASSWORD"
                secureTextEntry={!showConfirmPassword}
                textContentType="newPassword"
                autoComplete="new-password"
                passwordRules={PASSWORD_RULES}
                returnKeyType="go"
                onSubmitEditing={() => void handleReset()}
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                error={!!errors.confirmPassword}
                errorText={errors.confirmPassword?.message}
                rightIcon={
                  <Pressable
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                    accessibilityHint={
                      showConfirmPassword
                        ? "Hides the confirmation password characters"
                        : "Shows the confirmation password characters"
                    }
                    onPress={() => setShowConfirmPassword((current) => !current)}
                    hitSlop={8}
                  >
                    {showConfirmPassword ? (
                      <EyeOff color={palette.textMuted} size={15} />
                    ) : (
                      <Eye color={palette.textMuted} size={15} />
                    )}
                  </Pressable>
                }
              />
            )}
          />

          <View
            style={{
              backgroundColor: palette.surfaceRaised,
              borderRadius: componentRadii.card,
              padding: spacing[4],
            }}
          >
            <PasswordRequirements password={passwordValue ?? ""} />
          </View>

          <Button
            label="Update Password"
            onPress={handleReset}
            loading={isSubmitting}
            disabled={Boolean(linkError)}
            style={{ minHeight: 56 }}
          />
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
