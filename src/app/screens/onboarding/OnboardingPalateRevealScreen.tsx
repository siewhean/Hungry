import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo } from "react";
import { View } from "react-native";

import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { AppText, Button } from "@/components/ui";
import { NEUTRAL_TASTE_VECTOR, TASTE_DIMENSIONS } from "@/constants/taste";
import { palateExample, summarisePalate } from "@/features/onboarding/palateInsight";
import { useOnboardingScreenViewed } from "@/features/onboarding/useOnboardingScreenViewed";
import { confirmHaptic, tapHaptic } from "@/lib/haptics";
import { useOnboardingDraftStore } from "@/store/useOnboardingDraftStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingPalateReveal">;

/** Screen 13: the payoff for the six sliders. Tastes that were skipped show as Not set. */
export function OnboardingPalateRevealScreen({ navigation }: Props) {
  useOnboardingScreenViewed("palate-reveal");
  const { palette, radii, spacing } = useHungryTheme();
  const quiz = useOnboardingDraftStore((state) => state.quiz);
  const vector = quiz?.answers ?? NEUTRAL_TASTE_VECTOR;
  const answeredKeys = useMemo(() => quiz?.answeredKeys ?? [], [quiz]);
  const summary = summarisePalate(vector, answeredKeys);
  const example = palateExample(vector, answeredKeys);

  // One soft thud as the number lands.
  useEffect(() => {
    if (example) confirmHaptic();
  }, [example]);

  const line = summary.headline ?? "No problem, I will learn your palate as you use Hungry.";

  return (
    <OnboardingFrame
      screen="palate-reveal"
      onBack={() => navigation.goBack()}
      footer={
        <Button
          label="Continue"
          onPress={() => {
            tapHaptic();
            navigation.navigate("DietaryPreferences", {
              mode: "onboarding",
              initialPhase: "dietary",
            });
          }}
        />
      }
    >
      <MascotLine pose="celebrate" lineId="palate-reveal" text={line} />
      {example ? (
        <AppText variant="bodyBold" style={{ textAlign: "center" }}>
          {example}
        </AppText>
      ) : null}
      <View style={{ gap: spacing[2] }}>
        {TASTE_DIMENSIONS.map(({ key, label }) => {
          const answered = answeredKeys.includes(key);
          return (
            <View
              key={key}
              accessible
              accessibilityLabel={
                answered ? `${label} ${vector[key]} out of 10` : `${label} not set`
              }
              style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}
            >
              <AppText variant="bodySmall" style={{ width: 72 }}>
                {label}
              </AppText>
              <View
                style={{
                  backgroundColor: palette.border,
                  borderRadius: radii.pill,
                  flex: 1,
                  height: 8,
                  overflow: "hidden",
                }}
              >
                {answered ? (
                  <View
                    style={{
                      backgroundColor: palette.orange,
                      borderRadius: radii.pill,
                      height: 8,
                      width: `${Math.round((vector[key] / 10) * 100)}%`,
                    }}
                  />
                ) : null}
              </View>
              <AppText variant="micro" tone="secondary" style={{ textAlign: "right", width: 48 }}>
                {answered ? `${vector[key]}/10` : "Not set"}
              </AppText>
            </View>
          );
        })}
      </View>
      {summary.notSet.length > 0 && answeredKeys.length > 0 ? (
        <AppText variant="bodySmall" tone="secondary">
          You can finish the rest later from your taste profile.
        </AppText>
      ) : null}
    </OnboardingFrame>
  );
}
