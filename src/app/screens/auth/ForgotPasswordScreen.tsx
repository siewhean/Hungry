import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react-native";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { useUIStore } from "@/store/useUIStore";
import {
  trackAuthFailed,
  trackAuthScreenViewed,
  trackPasswordResetRequested,
} from "@/features/auth/authAnalytics";
import { validateEmail } from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";
import { AUTH_COPY } from "./authCopy";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;
type FormValues = { email: string };

export function ForgotPasswordScreen({ navigation }: Props) {
  const { colorScheme, palette, radii, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { email: "" } });

  useEffect(() => {
    trackAuthScreenViewed("forgot_password");
  }, []);

  const handleSend = handleSubmit(async ({ email }) => {
    try {
      if (getConfiguredDataSource() === "supabase") {
        await getHungryService().auth.forgotPassword(email);
        trackPasswordResetRequested();
        showToast({ message: AUTH_COPY.forgotPassword.sentToast, tone: "info" });
        navigation.navigate("Login");
        return;
      }
      showToast({ message: AUTH_COPY.forgotPassword.sentToast, tone: "info" });
      navigation.navigate("ResetPassword", { email });
    } catch (error) {
      trackAuthFailed("password_reset", "email", error);
      showToast({ message: AUTH_COPY.forgotPassword.genericErrorToast, tone: "error" });
    }
  });

  return (
    <FeedErrorBoundary
      title={AUTH_COPY.forgotPassword.errorTitle}
      body={AUTH_COPY.forgotPassword.errorBody}
    >
      <AuthScreenShell
        title={AUTH_COPY.forgotPassword.title}
        subtitle={AUTH_COPY.forgotPassword.subtitle}
        compact
        wordmarkColor={colorScheme === "dark" ? palette.white : palette.navy}
        footer={
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={AUTH_COPY.forgotPassword.backToLogin}
            accessibilityHint="Returns to the sign in screen"
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("Login");
              }
            }}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
            }}
          >
            <ArrowLeft color={palette.text} size={14} />
            <AppText tone="accent" style={{ fontWeight: "700" }}>
              {AUTH_COPY.forgotPassword.backToLogin}
            </AppText>
          </Pressable>
        }
      >
        <View style={{ gap: spacing[4] }}>
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: palette.orangeLight,
                borderRadius: radii.pill,
                height: 80,
                justifyContent: "center",
                width: 80,
              }}
            >
              <LockKeyhole color={palette.orange} size={30} />
            </View>
          </View>

          <Controller
            control={control}
            name="email"
            rules={{ validate: validateEmail }}
            render={({ field: { onChange, value } }) => (
              <Input
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="send"
                onSubmitEditing={() => void handleSend()}
                placeholder={AUTH_COPY.forgotPassword.emailPlaceholder}
                value={value}
                onChangeText={onChange}
                leftIcon={<Mail color={palette.textMuted} size={16} />}
                error={!!errors.email}
                errorText={errors.email?.message}
              />
            )}
          />
          <Button
            label={AUTH_COPY.forgotPassword.primaryButton}
            onPress={handleSend}
            loading={isSubmitting}
          />
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
