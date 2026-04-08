import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { OnboardingIntroTemplate } from "./OnboardingIntroTemplate";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingIntro2">;

export function OnboardingIntro2Screen({ navigation }: Props) {
  return (
    <OnboardingIntroTemplate
      title="See what people are actually eating"
      subtitle="The Home feed and Bites surface help you spot what's trending before you commit to any stall."
      stepIndex={2}
      totalSteps={3}
      eyebrow="Social cues without the noise"
      bullets={[
        "Short dish clips and photos from real stalls — no sponsored content.",
        "Save dishes you like and build your personal shortlist for the next meal.",
        "Read stories and guides when you want context beyond a raw directory.",
      ]}
      navigation={navigation}
      nextScreen="OnboardingIntro3"
      backScreen="OnboardingIntro1"
    />
  );
}
