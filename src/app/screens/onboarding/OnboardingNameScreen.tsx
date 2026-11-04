import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";

import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { Button, Input } from "@/components/ui";
import { nextOnboardingRoute } from "@/features/onboarding/flowRoutes";
import { MASCOT_NAME } from "@/features/onboarding/mascot";
import { useOnboardingScreenViewed } from "@/features/onboarding/useOnboardingScreenViewed";
import { tapHaptic } from "@/lib/haptics";
import {
  cleanOnboardingName,
  MAX_ONBOARDING_NAME_LENGTH,
  useOnboardingAnswersStore,
} from "@/store/useOnboardingAnswersStore";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingName">;

/** Screen 2: what should the mascot call you. The name is carried into the account step. */
export function OnboardingNameScreen({ navigation }: Props) {
  const [name, setName] = useState(() => useOnboardingAnswersStore.getState().displayName);
  const trimmed = cleanOnboardingName(name);

  useOnboardingScreenViewed("name");

  const next = () => {
    if (!trimmed) return;
    tapHaptic();
    useOnboardingAnswersStore.getState().setDisplayName(trimmed);
    navigation.navigate(nextOnboardingRoute("OnboardingName", true));
  };

  return (
    <OnboardingFrame
      screen="name"
      onBack={() => navigation.goBack()}
      footer={<Button label="Continue" disabled={!trimmed} onPress={next} />}
    >
      <MascotLine
        pose="wave"
        lineId="name"
        text={`Hi, I'm ${MASCOT_NAME}. What should I call you?`}
      />
      <Input
        label="Your name"
        value={name}
        onChangeText={setName}
        placeholder="First name"
        autoComplete="name"
        textContentType="givenName"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={MAX_ONBOARDING_NAME_LENGTH}
        returnKeyType="done"
        onSubmitEditing={next}
        accessibilityHint="Used to greet you and to fill in your account"
      />
    </OnboardingFrame>
  );
}
