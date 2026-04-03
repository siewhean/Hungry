import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { View } from "react-native";

import { Badge, Button, Card, Chip, AppText } from "@/components/ui";
import type { DietaryFlag } from "@/types/domain";
import { OnboardingScreenShell } from "./OnboardingScreenShell";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "DietaryPreferences">;

const options: DietaryFlag[] = ["halal", "vegetarian", "vegan", "pork_free", "nut_free", "gluten_free"];

export function DietaryPreferencesScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<DietaryFlag[]>([]);

  const toggle = (flag: DietaryFlag) => {
    setSelected((current) => (current.includes(flag) ? current.filter((value) => value !== flag) : [...current, flag]));
  };

  const handleNext = () => {
    navigation.navigate("LocationPermission");
  };

  return (
    <OnboardingScreenShell
      title="Dietary preferences"
      subtitle="Optional. Use this to tune what shows up first."
      stepLabel="SCR-007"
    >
      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="h3">Select any that apply</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {options.map((flag) => (
              <Chip key={flag} label={flag.replace("_", " ")} selected={selected.includes(flag)} onPress={() => toggle(flag)} />
            ))}
          </View>
          <Badge label={selected.length ? `${selected.length} selected` : "No restrictions"} tone="neutral" />
        </View>
      </Card>
      <Button label="Continue" onPress={handleNext} />
      <Button label="I have no restrictions" variant="ghost" onPress={handleNext} />
    </OnboardingScreenShell>
  );
}
