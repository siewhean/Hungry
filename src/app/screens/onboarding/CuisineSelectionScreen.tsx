import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Check } from "lucide-react-native";

import { AppText, Button, Card, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "CuisineSelection">;

const CUISINES = [
  { id: "local", label: "Local" },
  { id: "japanese", label: "Japanese" },
  { id: "western", label: "Western" },
  { id: "korean", label: "Korean" },
  { id: "thai", label: "Thai" },
  { id: "indian", label: "Indian" },
  { id: "chinese", label: "Chinese" },
  { id: "malay", label: "Malay" },
  { id: "italian", label: "Italian" },
];

export function CuisineSelectionScreen({ navigation }: Props) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleNext = () => {
    navigation.navigate("FoodSelection", { cuisines: selected });
  };

  return (
    <Screen
      title="What do you love?"
      subtitle="Pick your go-to cuisines to help us curate your feed."
    >
      <View style={{ flex: 1, gap: spacing[6] }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
          {CUISINES.map((cuisine) => {
            const isSelected = selected.includes(cuisine.id);
            return (
              <Pressable
                key={cuisine.id}
                onPress={() => toggle(cuisine.id)}
                style={({ pressed }) => [
                  {
                    width: "31%",
                    aspectRatio: 1,
                    borderRadius: radii.lg,
                    backgroundColor: isSelected ? palette.orangeLight : palette.surface,
                    borderColor: isSelected ? palette.orange : palette.border,
                    borderWidth: 2,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing[2],
                    opacity: pressed ? 0.9 : 1,
                  },
                  isSelected ? shadows.card : {},
                ]}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: radii.pill,
                    backgroundColor: isSelected ? palette.orange : palette.bgSoft,
                    alignItems: "center",
                    justifyContent: "center",
                    position: "absolute",
                    top: spacing[2],
                    right: spacing[2],
                  }}
                >
                  {isSelected && <Check size={14} color={palette.surface} strokeWidth={3} />}
                </View>
                <AppText
                  style={{
                    fontWeight: isSelected ? "800" : "600",
                    color: isSelected ? palette.text : palette.textSecondary,
                    textAlign: "center",
                  }}
                >
                  {cuisine.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <Button
          label="Next"
          onPress={handleNext}
          disabled={selected.length === 0}
          variant="primary"
        />
      </View>
    </Screen>
  );
}
