import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, MapPin } from "lucide-react-native";

import { AppHeader, AppText, Button, Card, Input } from "@/components/ui";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { OnboardingProgress } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { SORTED_SINGAPORE_AREAS } from "./singaporeAreas";
import { useMemo, useState } from "react";
import {
  ONBOARDING_ACTIONS_BOTTOM_PADDING,
  ONBOARDING_ACTIONS_GAP,
  ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
} from "./layoutConstants";

type Props = NativeStackScreenProps<OnboardingStackParamList, "ManualLocationPicker">;

export function ManualLocationPickerScreen({ navigation, route }: Props) {
  const isSettingsMode = route.params?.mode === "settings";
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const setManualSelection = useLocationStore((state) => state.setManualSelection);
  const storedManualLocation = useLocationStore((state) => state.manualLocation);
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const showToast = useUIStore((state) => state.showToast);
  const [query, setQuery] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(
    SORTED_SINGAPORE_AREAS.find(
      (area) => area.name.toLowerCase() === storedManualLocation?.toLowerCase(),
    )?.id ?? null,
  );

  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);
  const filteredAreas = useMemo(
    () =>
      normalizedQuery.length === 0
        ? SORTED_SINGAPORE_AREAS
        : SORTED_SINGAPORE_AREAS.filter((area) =>
            area.name.toLowerCase().includes(normalizedQuery),
          ),
    [normalizedQuery],
  );
  const selectedArea = SORTED_SINGAPORE_AREAS.find((area) => area.id === selectedAreaId) ?? null;
  const showNoResults = normalizedQuery.length > 0 && filteredAreas.length === 0;
  const isOnboarding = !isSettingsMode && !hasCompletedOnboarding;

  const handleSubmit = () => {
    if (!selectedArea) return;
    setManualSelection(selectedArea.name, selectedArea.coordinate);
    // Already-onboarded users reach this picker from Discover, the map or
    // Settings; they go straight back to where they came from.
    if (!isOnboarding) {
      showToast({ message: `Location set to ${selectedArea.name}.`, tone: "success" });
      navigation.goBack();
      return;
    }
    // First run: the location step is done; the optional taste quiz is next.
    navigation.navigate("TasteQuiz");
  };

  return (
    <SafeAreaView
      style={{ backgroundColor: palette.bg, flex: 1 }}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={{ backgroundColor: palette.bg, flex: 1, paddingHorizontal: spacing[3] }}>
        <AppHeader
          title="Pick a location"
          onBackPress={() => navigation.goBack()}
          left={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint="Returns to the previous screen without changing your location"
              onPress={() => navigation.goBack()}
              style={{
                alignItems: "center",
                borderRadius: radii.pill,
                height: 40,
                justifyContent: "center",
                width: 40,
              }}
            >
              <ArrowLeft color={palette.text} size={22} />
            </Pressable>
          }
        />

        {isOnboarding ? <OnboardingProgress step="location" /> : null}
        <Input
          placeholder="Search..."
          value={query}
          onChangeText={setQuery}
          enableMovingPlaceholder={false}
          accessibilityLabel="Search Singapore location"
        />
        {selectedArea ? (
          <Button
            label={`Selected: ${selectedArea.name}`}
            variant="secondary"
            size="sm"
            disabled
            style={{ marginTop: spacing[2] }}
          />
        ) : null}

        <View style={{ flex: 1, gap: spacing[2], paddingTop: spacing[3] }}>
          <ScrollView
            contentContainerStyle={{ gap: spacing[2], paddingBottom: spacing[1] }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {showNoResults ? (
              <AppText style={{ textAlign: "center" }} tone="secondary">
                No matching locations found.
              </AppText>
            ) : null}
            {!showNoResults
              ? filteredAreas.map((area) => (
                  <Pressable
                    key={area.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${area.name}`}
                    accessibilityHint="Sets this as your Hungry discovery location"
                    accessibilityState={{ selected: area.id === selectedAreaId }}
                    onPress={() => {
                      setSelectedAreaId(area.id);
                    }}
                  >
                    <Card
                      style={{
                        borderRadius: radii.md,
                        padding: spacing[2],
                        borderColor: area.id === selectedAreaId ? palette.orange : "transparent",
                        borderWidth: area.id === selectedAreaId ? 1.5 : 0,
                      }}
                    >
                      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                        <MapPin color={palette.orange} size={16} />
                        <AppText variant="bodyBold" numberOfLines={1} ellipsizeMode="tail">
                          {area.name}
                        </AppText>
                      </View>
                    </Card>
                  </Pressable>
                ))
              : null}
          </ScrollView>
        </View>

        <View
          style={{
            backgroundColor: palette.bg,
            gap: ONBOARDING_ACTIONS_GAP,
            paddingBottom: ONBOARDING_ACTIONS_BOTTOM_PADDING,
            paddingHorizontal: ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
            paddingTop: spacing[3],
          }}
        >
          <Button
            label="Continue"
            onPress={handleSubmit}
            disabled={!selectedArea}
            loading={false}
            style={shadows.floating}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
