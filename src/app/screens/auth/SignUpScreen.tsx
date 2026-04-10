import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Linking, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";

import { AppText, Button, HungryLogo, Input } from "@/components/ui";
import { validateEmail, validatePassword, validateRequired } from "@/features/auth/validation";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { AuthStackParamList } from "./AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;
type FormValues = { displayName: string; email: string; password: string };

export function SignUpScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const [showPassword, setShowPassword] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { displayName: "", email: "", password: "" },
  });

  const handleSignUp = handleSubmit((values) => {
    showToast({ message: "Account created. Please verify your email.", tone: "success" });
    navigation.navigate("EmailVerification", { email: values.email });
  });

  const handleProviderContinue = (provider: "google" | "apple") => {
    const providerEmail = provider === "google" ? "google.user@hungry.sg" : "apple.user@hungry.sg";
    showToast({ message: `Continue with ${provider === "google" ? "Google" : "Apple"} successful.`, tone: "success" });
    navigation.navigate("EmailVerification", { email: providerEmail });
  };

  return (
    <SafeAreaView style={{ backgroundColor: "#FFF8F2", flex: 1 }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing[5], paddingVertical: spacing[3] }}>
        <Pressable onPress={() => navigation.goBack()}><ArrowLeft color={palette.orange} size={18} /></Pressable>
        <AppText variant="h1" style={{ color: palette.orange }}>Hungry</AppText>
        <View style={{ width: 18 }} />
      </View>

      <View style={{ flex: 1, gap: spacing[4], paddingHorizontal: spacing[5] }}>
        <View style={{ alignItems: "center", gap: spacing[3] }}>
          <HungryLogo size={80} showWordmark={false} />
          <AppText variant="display" style={{ color: "#1E1B16", textAlign: "center" }}>Create account</AppText>
          <AppText tone="secondary" style={{ textAlign: "center" }}>
            Join our community of food lovers and discover the best tastes in the city.
          </AppText>
        </View>

        <View style={{ gap: spacing[2] }}>
          <Button label="Continue with Google" variant="secondary" onPress={() => handleProviderContinue("google")} style={{ borderRadius: 24, minHeight: 56 }} />
          <Button label="Continue with Apple" variant="secondary" onPress={() => handleProviderContinue("apple")} style={{ borderRadius: 24, minHeight: 56 }} />
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
          <View style={{ backgroundColor: "rgba(227,191,180,0.3)", flex: 1, height: 1 }} />
          <AppText variant="micro" tone="secondary">OR</AppText>
          <View style={{ backgroundColor: "rgba(227,191,180,0.3)", flex: 1, height: 1 }} />
        </View>

        <View style={{ gap: spacing[2] }}>
          <Controller
            control={control}
            name="displayName"
            rules={{ validate: (value) => validateRequired(value, "Display name") }}
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 4 }}>
                <Input placeholder="Name" value={value} onChangeText={onChange} />
                {errors.displayName ? <AppText variant="bodySmall" style={{ color: palette.error }}>{errors.displayName.message}</AppText> : null}
              </View>
            )}
          />
          <Controller
            control={control}
            name="email"
            rules={{ validate: validateEmail }}
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 4 }}>
                <Input placeholder="Email Address" value={value} onChangeText={onChange} />
                {errors.email ? <AppText variant="bodySmall" style={{ color: palette.error }}>{errors.email.message}</AppText> : null}
              </View>
            )}
          />
          <Controller
            control={control}
            name="password"
            rules={{ validate: (value) => validatePassword(value, 8) }}
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 2 }}>
                <Input
                  placeholder="Password"
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry={!showPassword}
                  rightIcon={(
                    <Pressable onPress={() => setShowPassword((current) => !current)} hitSlop={8}>
                      {showPassword ? <EyeOff color="#B79D8F" size={15} /> : <Eye color="#B79D8F" size={15} />}
                    </Pressable>
                  )}
                />
                {errors.password ? <AppText variant="bodySmall" style={{ color: palette.error }}>{errors.password.message}</AppText> : null}
              </View>
            )}
          />
        </View>

        <Button label="Create account" onPress={handleSignUp} style={{ borderRadius: 24, minHeight: 56 }} />

        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
          <AppText variant="bodySmall" tone="secondary">By creating an account, you agree to Hungry&apos;s </AppText>
          <Pressable onPress={() => void Linking.openURL("https://hungry.sg/terms")}>
            <AppText variant="bodySmall" tone="accent">Terms of Service</AppText>
          </Pressable>
          <AppText variant="bodySmall" tone="secondary"> and </AppText>
          <Pressable onPress={() => void Linking.openURL("https://hungry.sg/privacy")}>
            <AppText variant="bodySmall" tone="accent">Privacy Policy</AppText>
          </Pressable>
          <AppText variant="bodySmall" tone="secondary">.</AppText>
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
          <AppText tone="secondary">Already have an account? </AppText>
          <Pressable onPress={() => navigation.navigate("Login")}>
            <AppText tone="accent" style={{ fontFamily: "Nunito_700Bold" }}>Log in</AppText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
