import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Compass, Heart, Shuffle } from "lucide-react-native";

import { AppText, Button } from "@/components/ui";
import { FOOD_OPENNESS_OPTIONS } from "@/constants/taste";
import { DEFAULT_FOOD_OPENNESS, resolveFoodOpenness } from "@/lib/ai/exploration";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { FoodOpenness } from "@/types/domain";
import {
  OnboardingProgress,
  trackOnboardingStepSkipped,
  trackOnboardingStepViewed,
} from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";
import {
  ONBOARDING_ACTIONS_BOTTOM_PADDING,
  ONBOARDING_ACTIONS_GAP,
  ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
} from "./layoutConstants";

type Props = NativeStackScreenProps<OnboardingStackParamList, "FoodOpenness">;

const OPTION_ICONS: Record<FoodOpenness, typeof Heart> = {
  favourites: Heart,
  mix: Shuffle,
  adventurous: Compass,
};

/** "How open are you to trying new food?" Sets the familiar-versus-new mix of recommendations. */
export function FoodOpennessScreen({ navigation, route }: Props) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const isSettings = route.params?.mode === "settings";
  const tasteProfile = useProfileStore((state) => state.profile.tasteProfile);
  const setFoodOpenness = useProfileStore((state) => state.setFoodOpenness);
  const showToast = useUIStore((state) => state.showToast);
  const [selected, setSelected] = useState<FoodOpenness>(() =>
    tasteProfile?.foodOpenness ? resolveFoodOpenness(tasteProfile) : DEFAULT_FOOD_OPENNESS,
  );

  useEffect(() => {
    if (!isSettings) trackOnboardingStepViewed("openness");
  }, [isSettings]);

  const finish = (openness: FoodOpenness) => {
    setFoodOpenness(openness, isSettings ? "settings" : "onboarding");
    if (isSettings) {
      showToast({ message: "Recommendations updated.", tone: "success" });
      navigation.goBack();
      return;
    }
    navigation.navigate("TasteProfileResult");
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.bg }}
      edges={["top", "left", "right", "bottom"]}
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          minHeight: 64,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[3],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={{
            alignItems: "center",
            borderRadius: radii.pill,
            height: 40,
            justifyContent: "center",
            width: 40,
          }}
        >
          <ArrowLeft color={palette.text} size={22} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[3] }}>
        {isSettings ? null : <OnboardingProgress step="openness" />}
        <View style={{ gap: spacing[2] }}>
          <AppText variant="h2" accessibilityRole="header">
            How open are you to trying new food?
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            We use this to balance dishes you know with new ones. You can change it in Settings.
          </AppText>
        </View>

        <View accessibilityRole="radiogroup" style={{ gap: spacing[2] }}>
          {FOOD_OPENNESS_OPTIONS.map((option) => {
            const isSelected = option.value === selected;
            const Icon = OPTION_ICONS[option.value];
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={option.label}
                accessibilityHint={option.description}
                onPress={() => setSelected(option.value)}
                style={{
                  alignItems: "center",
                  backgroundColor: isSelected ? palette.orangeLight : palette.surface,
                  borderColor: isSelected ? palette.orange : palette.border,
                  borderRadius: componentRadii.card,
                  borderWidth: isSelected ? 2 : 1,
                  flexDirection: "row",
                  gap: spacing[3],
                  minHeight: 78,
                  padding: spacing[3],
                }}
              >
                <Icon color={isSelected ? palette.orange : palette.textSecondary} size={22} />
                <View style={{ flex: 1, gap: spacing[1] }}>
                  <AppText variant="bodyBold">{option.label}</AppText>
                  <AppText variant="micro" tone="secondary">
                    {option.description}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View
        style={{
          gap: ONBOARDING_ACTIONS_GAP,
          paddingBottom: ONBOARDING_ACTIONS_BOTTOM_PADDING,
          paddingHorizontal: ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
          paddingTop: spacing[3],
        }}
      >
        <Button label={isSettings ? "Save" : "Continue"} onPress={() => finish(selected)} />
        {isSettings ? null : (
          <Button
            label="Skip"
            variant="ghost"
            onPress={() => {
              trackOnboardingStepSkipped("openness");
              finish(DEFAULT_FOOD_OPENNESS);
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
