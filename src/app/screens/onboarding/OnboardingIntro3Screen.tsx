import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { OnboardingIntroTemplate } from "./OnboardingIntroTemplate";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingIntro3">;

export function OnboardingIntro3Screen({ navigation }: Props) {
  return (
    <OnboardingIntroTemplate
      title="Faster picks with a taste profile"
      subtitle="A 60-second setup lets Hungry tune recommendations, Dish Roulette, and search to your real preferences."
      stepIndex={3}
      totalSteps={3}
      eyebrow="Personalisation"
      bullets={[
        "Rate how much you like sweet, spicy, rich, or aromatic dishes in one quick quiz.",
        "Set dietary flags once — halal, vegetarian, nut-free — and never see wrong results.",
        "Share location only when you want nearby ranking and faster map browsing.",
      ]}
      navigation={navigation}
      nextScreen="TasteQuiz"
      backScreen="OnboardingIntro2"
    />
  );
}
