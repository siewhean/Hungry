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
      totalSteps={1}
      eyebrow="Dish-first discovery"
      bullets={[
        "See a dish that looks good before you commit to walking there.",
        "Save dishes you like and see what people near you are eating.",
        "A one-minute taste setup tunes picks to your cravings and diet.",
      ]}
      navigation={navigation}
      nextScreen="CuisineSelection"
    />
  );
}
