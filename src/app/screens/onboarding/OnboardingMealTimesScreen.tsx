import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { View } from "react-native";

import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { AppText, Button, Chip } from "@/components/ui";
import { nextOnboardingRoute } from "@/features/onboarding/flowRoutes";
import { useOnboardingScreenViewed } from "@/features/onboarding/useOnboardingScreenViewed";
import {
  MEAL_KEYS,
  MEAL_LABELS,
  MEAL_TIME_OPTIONS,
  formatMealTime,
  setMealTime,
  toggleMeal,
  type MealTimes,
} from "@/features/onboarding/mealTimes";
import { tapHaptic } from "@/lib/haptics";
import { useOnboardingAnswersStore } from "@/store/useOnboardingAnswersStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingMealTimes">;

/**
 * Screen 5: which meals the person usually eats out, and when. The lunch and dinner times set when
 * the meal-picks push arrives. Optional; Continue is always on.
 */
export function OnboardingMealTimesScreen({ navigation }: Props) {
  useOnboardingScreenViewed("meal-times");
  const { spacing } = useHungryTheme();
  const [times, setTimes] = useState<MealTimes>(
    () => useOnboardingAnswersStore.getState().mealTimes,
  );

  const next = () => {
    tapHaptic();
    useOnboardingAnswersStore.getState().setMealTimes(times);
    navigation.navigate(nextOnboardingRoute("OnboardingMealTimes", true));
  };

  return (
    <OnboardingFrame
      screen="meal-times"
      onBack={() => navigation.goBack()}
      footer={<Button label="Continue" onPress={next} />}
    >
      <MascotLine pose="clipboard" lineId="meal-times" text="When do you usually eat out?" />
      <AppText variant="bodySmall" tone="secondary">
        Pick any. I will send meal picks about 45 minutes before, if you turn them on later.
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        {MEAL_KEYS.map((meal) => (
          <Chip
            key={meal}
            label={MEAL_LABELS[meal]}
            accessibilityLabel={`Meal ${MEAL_LABELS[meal]}`}
            selected={Boolean(times[meal])}
            onPress={() => setTimes((current) => toggleMeal(current, meal))}
          />
        ))}
      </View>
      {MEAL_KEYS.filter((meal) => times[meal]).map((meal) => (
        <View key={meal} style={{ gap: spacing[2] }}>
          <AppText variant="bodyBold">{MEAL_LABELS[meal]} usually starts at</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {MEAL_TIME_OPTIONS[meal].map((time) => (
              <Chip
                key={time}
                label={formatMealTime(time)}
                accessibilityLabel={`${MEAL_LABELS[meal]} at ${formatMealTime(time)}`}
                selected={times[meal] === time}
                onPress={() => setTimes((current) => setMealTime(current, meal, time))}
              />
            ))}
          </View>
        </View>
      ))}
    </OnboardingFrame>
  );
}
