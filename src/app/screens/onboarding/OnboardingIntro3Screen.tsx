import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { OnboardingIntroTemplate } from "./OnboardingIntroTemplate";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingIntro3">;

export function OnboardingIntro3Screen({ navigation }: Props) {
  return (
    <OnboardingIntroTemplate
      title="Tune recommendations to your taste"
      subtitle="A quick taste setup helps Hungry prioritize dishes that fit your cravings and dietary preferences."
      stepIndex={3}
      totalSteps={3}
      eyebrow="Personalized discovery"
      bullets={[
        "Set your flavor profile in seconds with the taste quiz.",
        "Choose dietary preferences to keep recommendations relevant.",
        "Share your location to see dishes near you first.",
      ]}
      navigation={navigation}
      nextScreen="CuisineSelection"
      backScreen="OnboardingIntro2"
    />
  );
}
