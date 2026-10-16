import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { OnboardingIntroTemplate } from "./OnboardingIntroTemplate";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingIntro2">;

export function OnboardingIntro2Screen({ navigation }: Props) {
  return (
    <OnboardingIntroTemplate
      title="Find the dish, then the stall"
      subtitle="Search for what you're craving and see exactly which stall serves it before you head over."
      stepIndex={2}
      totalSteps={3}
      eyebrow="Search and details"
      bullets={[
        "Search dishes by name or craving across nearby stalls.",
        "Open dish and stall details to see what's on offer and where it is.",
        "Save dishes you like to your favourites for the next meal.",
      ]}
      navigation={navigation}
      nextScreen="OnboardingIntro3"
      backScreen="OnboardingIntro1"
    />
  );
}
