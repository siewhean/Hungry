import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";

import { AppText, Button, Input } from "@/components/ui";
import { validateEmail, validatePassword, validateRequired } from "@/features/auth/validation";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { authFieldLabels } from "@/features/auth/authContent";
import { AuthScreenShell } from "./AuthScreenShell";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;

type FormValues = {
  displayName: string;
  email: string;
  password: string;
};

export function SignUpScreen({ navigation }: Props) {
  const { palette } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
    },
  });

  const handleSignUp = handleSubmit(() => {
    showToast({ message: "Account created. Please verify your email.", tone: "success" });
    navigation.navigate("EmailVerification");
  });

  const handleGoogle = () => {
    showToast({ message: "Google sign-up mocked. Verify the account to continue.", tone: "success" });
    navigation.navigate("EmailVerification");
  };

  const handleApple = () => {
    showToast({ message: "Apple sign-up mocked. Verify the account to continue.", tone: "success" });
    navigation.navigate("EmailVerification");
  };

  return (
    <AuthScreenShell
      title="Create account"
      subtitle="Create your Hungry account before you start browsing dishes, stalls, and editorial content."
      footer={<Button label="Already have an account? Log in" variant="ghost" onPress={() => navigation.navigate("Login")} />}
    >
      <Button label="Continue with Google" variant="secondary" onPress={handleGoogle} />
      <Button label="Continue with Apple" variant="secondary" onPress={handleApple} />
      <AppText variant="micro" tone="muted">
        OR CREATE AN ACCOUNT WITH EMAIL
      </AppText>
      <Controller
        control={control}
        name="displayName"
        rules={{ validate: (value) => validateRequired(value, "Display name") }}
        render={({ field: { onChange, value } }) => (
          <View style={{ gap: 4 }}>
            <Input
              label={authFieldLabels.signUp.displayName}
              placeholder="Wei Ming"
              value={value}
              onChangeText={onChange}
            />
            {errors.displayName ? (
              <AppText variant="bodySmall" style={{ color: palette.error }}>
                {errors.displayName.message}
              </AppText>
            ) : null}
          </View>
        )}
      />
      <Controller
        control={control}
        name="email"
        rules={{ validate: validateEmail }}
        render={({ field: { onChange, value } }) => (
          <View style={{ gap: 4 }}>
            <Input
              label={authFieldLabels.signUp.email}
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
      <Controller
        control={control}
        name="password"
        rules={{ validate: (value) => validatePassword(value, 8) }}
        render={({ field: { onChange, value } }) => (
          <View style={{ gap: 4 }}>
            <Input
              label={authFieldLabels.signUp.password}
              secureTextEntry
              placeholder="Minimum 8 characters"
              value={value}
              onChangeText={onChange}
            />
            {errors.password ? (
              <AppText variant="bodySmall" style={{ color: palette.error }}>
                {errors.password.message}
              </AppText>
            ) : null}
          </View>
        )}
      />
      <Button label="Create account" onPress={handleSignUp} />
      <AppText variant="bodySmall" tone="muted">
        By continuing, you accept the Hungry terms and privacy policy.
      </AppText>
    </AuthScreenShell>
  );
}
