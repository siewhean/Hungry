import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react-native";

import { AppText, Button, FeedErrorBoundary, Input } from "@/components/ui";
import { useUIStore } from "@/store/useUIStore";
import { validateEmail } from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";
import { AuthScreenShell } from "./AuthScreenShell";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;
type FormValues = { email: string };

export function ForgotPasswordScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { email: "" } });

  const handleSend = handleSubmit(async ({ email }) => {
    try {
      if (getConfiguredDataSource() === "supabase") {
        await getHungryService().auth.forgotPassword(email);
      }
      showToast({ message: "If the email exists, a reset link was sent.", tone: "info" });
      navigation.navigate("ResetPassword");
    } catch {
      showToast({ message: "Could not send reset link. Please try again.", tone: "error" });
    }
  });

  return (
    <FeedErrorBoundary
      title="Password recovery unavailable"
      body="Couldn't load password recovery right now. Please retry."
    >
      <AuthScreenShell
        title="Forgot password"
        subtitle="Enter your email address and we'll send reset instructions."
        footer={
          <Pressable
            onPress={() => navigation.navigate("Login")}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
            }}
          >
            <ArrowLeft color={palette.orange} size={14} />
            <AppText tone="accent" style={{ fontWeight: "700" }}>
              Back to login
            </AppText>
          </Pressable>
        }
      >
        <View style={{ gap: spacing[4] }}>
          <View style={{ alignItems: "center", gap: spacing[3] }}>
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
            <AppText variant="display" style={{ textAlign: "center" }}>
              Forgot password
            </AppText>
            <AppText tone="secondary" style={{ textAlign: "center" }}>
              Enter your email address and we&apos;ll send you a link to reset your password and get
              you back to your table.
            </AppText>
          </View>

          <Controller
            control={control}
            name="email"
            rules={{ validate: validateEmail }}
            render={({ field: { onChange, value } }) => (
              <Input
                label="EMAIL ADDRESS"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="chef@restaurant.com"
                value={value}
                onChangeText={onChange}
                leftIcon={<Mail color={palette.textMuted} size={16} />}
                error={!!errors.email}
                errorText={errors.email?.message}
              />
            )}
          />
          <Button label="Send reset link" onPress={handleSend} style={{ minHeight: 56 }} />
          <View
            style={{
              backgroundColor: palette.infoSoft,
              borderRadius: 16,
              flexDirection: "row",
              gap: spacing[2],
              padding: spacing[3],
            }}
          >
            <AppText variant="micro" tone="secondary" style={{ flex: 1 }}>
              We keep this flow secure and simple so you can return to dish discovery quickly.
            </AppText>
          </View>
        </View>
      </AuthScreenShell>
    </FeedErrorBoundary>
  );
}
