import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { View, useWindowDimensions } from "react-native";

import { FoodSwapStage } from "@/components/onboarding/FoodSwapStage";
import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { TasteSlider } from "@/components/onboarding/TasteSlider";
import { AppText, Button } from "@/components/ui";
import { nextOnboardingRoute } from "@/features/onboarding/flowRoutes";
import {
  PRICE_STOPS,
  budgetForSliderValue,
  priceBubble,
  sliderValueForBudget,
} from "@/features/onboarding/priceStops";
import { nearestStopIndex } from "@/features/onboarding/tasteSliderStops";
import { useOnboardingScreenViewed } from "@/features/onboarding/useOnboardingScreenViewed";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { tapHaptic } from "@/lib/haptics";
import { useOnboardingDraftStore } from "@/store/useOnboardingDraftStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingPrice">;

/** Screen 16: the most the person would happily pay for one dish. Replaces the two budget chips. */
export function OnboardingPriceScreen({ navigation }: Props) {
  useOnboardingScreenViewed("price");
  const { spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [value, setValue] = useState(() =>
    sliderValueForBudget(useProfileStore.getState().profile.maxDishBudget),
  );
  const [live, setLive] = useState(value);
  const stopIndex = nearestStopIndex(live);
  const stop = PRICE_STOPS[stopIndex]!;

  const next = () => {
    tapHaptic();
    const budget = budgetForSliderValue(value);
    useProfileStore.getState().setMaxDishBudget(budget, { surface: "onboarding" });
    // The resume draft keeps the choice too, in case the app closes before the account step.
    const draft = useOnboardingDraftStore.getState();
    if (draft.dietary) draft.rememberDietary({ ...draft.dietary, maxDishBudget: budget ?? null });
    navigation.navigate(nextOnboardingRoute("OnboardingPrice", true));
  };

  return (
    <OnboardingFrame
      screen="price"
      onBack={() => navigation.goBack()}
      footer={<Button label="Continue" onPress={next} />}
    >
      <MascotLine
        small
        pose="clipboard"
        lineId="price"
        text="What's the most you'd happily pay for one dish?"
      />
      <FoodSwapStage
        stops={PRICE_STOPS}
        stopIndex={stopIndex}
        reduceMotion={reduceMotion}
        size={Math.min(240, Math.round(width * 0.6))}
      />
      <View style={{ gap: spacing[1] }}>
        <TasteSlider
          value={value}
          bubbleLabel={priceBubble}
          onMove={setLive}
          onSettle={(settled) => {
            setValue(settled);
            setLive(settled);
          }}
          accessibilityLabel="Most you would pay for one dish"
          accessibilityValueText={`${stop.caption}, like ${stop.dish}`}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <AppText variant="micro" tone="secondary">
            {PRICE_STOPS[0].caption}
          </AppText>
          <AppText variant="micro" tone="secondary">
            {PRICE_STOPS[PRICE_STOPS.length - 1]!.caption}
          </AppText>
        </View>
      </View>
      <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
        I will hide dishes above this price. You can change it any time.
      </AppText>
    </OnboardingFrame>
  );
}
