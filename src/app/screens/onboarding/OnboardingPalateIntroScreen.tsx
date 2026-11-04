import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";

import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { AppText, Button } from "@/components/ui";
import { nextOnboardingRoute } from "@/features/onboarding/flowRoutes";
import { useOnboardingScreenViewed } from "@/features/onboarding/useOnboardingScreenViewed";
import {
  LAKSA_STANDARD,
  SENSITIVE_DINER,
  TOLERANT_DINER,
  laksaFeltBy,
} from "@/features/onboarding/palateInsight";
import { tapHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingPalateIntro">;

function DinerCard({ name, felt }: { name: string; felt: number }) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${name} feels it as ${felt} out of 10`}
      style={{
        alignItems: "center",
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        flex: 1,
        gap: spacing[1],
        padding: spacing[3],
      }}
    >
      <AppText variant="bodyBold">{name}</AppText>
      <AppText variant="h1">{felt}/10</AppText>
      <AppText variant="micro" tone="secondary">
        feels it as
      </AppText>
    </View>
  );
}

/** Screen 6: the same laksa tastes different to two people, which is why the six sliders follow. */
export function OnboardingPalateIntroScreen({ navigation }: Props) {
  useOnboardingScreenViewed("palate-intro");
  const { spacing } = useHungryTheme();
  return (
    <OnboardingFrame
      screen="palate-intro"
      onBack={() => navigation.goBack()}
      footer={
        <Button
          label="Continue"
          onPress={() => {
            tapHaptic();
            navigation.navigate(nextOnboardingRoute("OnboardingPalateIntro", true));
          }}
        />
      }
    >
      <MascotLine pose="thinking" lineId="palate-intro" text="Same laksa, two tongues." />
      <AppText variant="body">
        A laksa is {LAKSA_STANDARD}/10 spicy for everyone. How it feels depends on the person.
      </AppText>
      <View style={{ flexDirection: "row", gap: spacing[3] }}>
        <DinerCard name={SENSITIVE_DINER.name} felt={laksaFeltBy(SENSITIVE_DINER.level)} />
        <DinerCard name={TOLERANT_DINER.name} felt={laksaFeltBy(TOLERANT_DINER.level)} />
      </View>
      <AppText variant="body" tone="secondary">
        Tell me your palate and I will show every dish at your level.
      </AppText>
    </OnboardingFrame>
  );
}
