import { useState } from "react";
import { View } from "react-native";
import Slider from "@react-native-community/slider";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Card, Screen } from "@/components/ui";
import { TASTE_DIMENSIONS } from "@/constants/taste";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export function TasteFilterScreen() {
  const navigation = useNavigation<RootNavigation>();
  const { palette, spacing } = useHungryTheme();
  const filters = useSearchStore((state) => state.filters);
  const setTasteValues = useSearchStore((state) => state.setTasteValues);

  const profile = useProfileStore((state) => state.profile);

  const [draft, setDraft] = useState({ ...filters.tasteValues });

  return (
    <Screen title="Taste filters" subtitle="Slide each dimension to match the current craving.">
      <View style={{ gap: spacing[4] }}>
        <Card style={{ gap: spacing[4] }}>
          {TASTE_DIMENSIONS.map((dimension) => (
            <View key={dimension.key} style={{ gap: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <AppText variant="h3">{dimension.label}</AppText>
                <AppText variant="price">{Math.round(draft[dimension.key])}</AppText>
              </View>
              <Slider
                accessibilityLabel={`${dimension.label} preference`}
                accessibilityValue={{ min: 0, max: 10, now: draft[dimension.key] }}
                minimumValue={0}
                maximumValue={10}
                step={1}
                minimumTrackTintColor={palette.orange}
                maximumTrackTintColor={palette.border}
                thumbTintColor={palette.orange}
                value={draft[dimension.key]}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    [dimension.key]: value,
                  })
                }
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: -4,
                }}
              >
                <AppText variant="micro" tone="secondary">
                  LOW
                </AppText>
                <AppText variant="micro" tone="secondary">
                  HIGH
                </AppText>
              </View>
            </View>
          ))}
        </Card>
        <Button
          label="Reset to my profile"
          variant="secondary"
          onPress={() => setDraft({ ...profile.tasteVector })}
        />
        <Button
          label="Apply filters"
          onPress={() => {
            setTasteValues(draft);
            navigation.goBack();
          }}
        />
      </View>
    </Screen>
  );
}
