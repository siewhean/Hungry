import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Slider from "@react-native-community/slider";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Button, Card, AppText } from "@/components/ui";
import { TASTE_DIMENSIONS } from "@/constants/taste";
import { useHungryTheme } from "@/theme";
import type { TasteVector } from "@/types/domain";
import { OnboardingScreenShell } from "./OnboardingScreenShell";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteQuiz">;

const initialValues: TasteVector = {
  sweet: 5,
  spicy: 6,
  sour: 4,
  salty: 5,
  rich: 6,
  aromatic: 6,
};

export function TasteQuizScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const [values, setValues] = useState<TasteVector>(initialValues);

  return (
    <OnboardingScreenShell
      title="Taste quiz"
      subtitle="Seed your preference profile with six quick sliders."
      stepLabel="SCR-006"
    >
      <ScrollView contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[6] }}>
        {TASTE_DIMENSIONS.map((dimension) => (
          <Card key={dimension.key}>
            <AppText variant="h3">{dimension.label}</AppText>
            <Slider
              minimumValue={0}
              maximumValue={10}
              step={1}
              minimumTrackTintColor={palette.orange}
              maximumTrackTintColor={palette.border}
              thumbTintColor={palette.orange}
              value={values[dimension.key]}
              onValueChange={(next) => setValues((current) => ({ ...current, [dimension.key]: next }))}
            />
            <AppText tone="secondary">{values[dimension.key]} / 10</AppText>
          </Card>
        ))}
        <Button label="Continue" onPress={() => navigation.navigate("DietaryPreferences")} />
        <Button label="Skip quiz" variant="ghost" onPress={() => navigation.navigate("DietaryPreferences")} />
      </ScrollView>
    </OnboardingScreenShell>
  );
}

