import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { OnboardingIntroTemplate } from "./OnboardingIntroTemplate";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingIntro1">;

export function OnboardingIntro1Screen({ navigation }: Props) {
  return (
    <OnboardingIntroTemplate
      title="Start with the dish, not the brand"
      subtitle="Hungry shows you the meal first — you only dig into the stall when it looks worth the queue."
      stepIndex={1}
      totalSteps={3}
      eyebrow="Dish-first discovery"
      bullets={[
        "See a dish that looks good before you commit to walking there.",
        "Search by dish or craving — not just restaurant name.",
        "Works across hawker centres, food courts, kopitiams, and malls.",
      ]}
      navigation={navigation}
      nextScreen="OnboardingIntro2"
    />
  );
}
