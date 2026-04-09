import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";

import { AppText, Button, Input, InlineBanner } from "@/components/ui";
import { AuthScreenShell } from "./AuthScreenShell";
import type { AuthStackParamList } from "./AuthStack";
import { useUIStore } from "@/store/useUIStore";
import { validateEmail } from "@/features/auth/validation";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

type FormValues = {
  email: string;
};

export function ForgotPasswordScreen({ navigation }: Props) {
  const { palette } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { email: "" },
  });

  const handleSend = handleSubmit(() => {
    showToast({ message: "If the email exists, a reset link was sent.", tone: "info" });
    navigation.navigate("ResetPassword");
  });

  return (
    <AuthScreenShell
      title="Reset password"
      subtitle="We will send a link without revealing whether the address exists."
      footer={<Button label="Back to log in" variant="ghost" onPress={() => navigation.navigate("Login")} />}
    >
      <Controller
        control={control}
        name="email"
        rules={{ validate: validateEmail }}
        render={({ field: { onChange, value } }) => (
          <View style={{ gap: 4 }}>
            <Input
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="weiming@example.com"
              value={value}
              onChangeText={onChange}
            />
            {errors.email ? (
              <AppText variant="bodySmall" style={{ color: palette.error }}>
                {errors.email.message}
              </AppText>
            ) : null}
          </View>
        )}
      />
      <InlineBanner tone="info" message="Check your inbox after you submit. The link expires soon." />
      <Button label="Send reset link" onPress={handleSend} />
    </AuthScreenShell>
  );
}
