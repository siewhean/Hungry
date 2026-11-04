import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { FEATURE_FLAGS } from "@/constants/featureFlags";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { TasteQuizScreen } from "./TasteQuizScreen";
import { TasteSliderQuizScreen } from "./TasteSliderQuizScreen";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteQuiz">;

/**
 * First-run taste questions use the sliders when the flag is on. A retake from Profile (mode
 * "profile") keeps the card quiz until the sliders also cover the dietary step there.
 */
export function TasteQuizRoute(props: Props) {
  const useSliders =
    FEATURE_FLAGS.sliderOnboardingEnabled && props.route.params?.mode !== "profile";
  return useSliders ? <TasteSliderQuizScreen {...props} /> : <TasteQuizScreen {...props} />;
}
