import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, MapPin } from "lucide-react-native";

import { AppHeader, AppText, Button, Card, Input } from "@/components/ui";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import type { Coordinate } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { useMemo, useState } from "react";
import {
  ONBOARDING_ACTIONS_BOTTOM_PADDING,
  ONBOARDING_ACTIONS_GAP,
  ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
} from "./layoutConstants";

type Props = NativeStackScreenProps<OnboardingStackParamList, "ManualLocationPicker">;

const SINGAPORE_AREA_LIST = [
  { id: "ang-mo-kio", name: "Ang Mo Kio", coordinate: { latitude: 1.3691, longitude: 103.8454 } },
  { id: "bedok", name: "Bedok", coordinate: { latitude: 1.3236, longitude: 103.9273 } },
  { id: "bishan", name: "Bishan", coordinate: { latitude: 1.3509, longitude: 103.835 } },
  { id: "boon-lay", name: "Boon Lay", coordinate: { latitude: 1.3387, longitude: 103.7055 } },
  { id: "bukit-batok", name: "Bukit Batok", coordinate: { latitude: 1.349, longitude: 103.7495 } },
  { id: "bukit-merah", name: "Bukit Merah", coordinate: { latitude: 1.2823, longitude: 103.8229 } },
  {
    id: "bukit-panjang",
    name: "Bukit Panjang",
    coordinate: { latitude: 1.3801, longitude: 103.7613 },
  },
  { id: "bukit-timah", name: "Bukit Timah", coordinate: { latitude: 1.3294, longitude: 103.8021 } },
  {
    id: "central-area",
    name: "Central Area",
    coordinate: { latitude: 1.2808, longitude: 103.8515 },
  },
  {
    id: "choa-chu-kang",
    name: "Choa Chu Kang",
    coordinate: { latitude: 1.3844, longitude: 103.7479 },
  },
  { id: "changi", name: "Changi", coordinate: { latitude: 1.3566, longitude: 103.9897 } },
  { id: "chinatown", name: "Chinatown", coordinate: { latitude: 1.2836, longitude: 103.8436 } },
  { id: "clementi", name: "Clementi", coordinate: { latitude: 1.3151, longitude: 103.7652 } },
  { id: "geylang", name: "Geylang", coordinate: { latitude: 1.3182, longitude: 103.8871 } },
  { id: "hougang", name: "Hougang", coordinate: { latitude: 1.3712, longitude: 103.8922 } },
  { id: "jalan-besar", name: "Jalan Besar", coordinate: { latitude: 1.3078, longitude: 103.8559 } },
  { id: "jurong-east", name: "Jurong East", coordinate: { latitude: 1.3331, longitude: 103.7437 } },
  { id: "jurong-west", name: "Jurong West", coordinate: { latitude: 1.3404, longitude: 103.7066 } },
  { id: "kallang", name: "Kallang", coordinate: { latitude: 1.3114, longitude: 103.871 } },
  {
    id: "lim-chu-kang",
    name: "Lim Chu Kang",
    coordinate: { latitude: 1.4233, longitude: 103.7102 },
  },
  { id: "mandai", name: "Mandai", coordinate: { latitude: 1.4406, longitude: 103.81 } },
  {
    id: "marine-parade",
    name: "Marine Parade",
    coordinate: { latitude: 1.3023, longitude: 103.9019 },
  },
  { id: "novena", name: "Novena", coordinate: { latitude: 1.3194, longitude: 103.8431 } },
  { id: "orchard", name: "Orchard", coordinate: { latitude: 1.3048, longitude: 103.8318 } },
  { id: "outram", name: "Outram", coordinate: { latitude: 1.2812, longitude: 103.8386 } },
  { id: "pasir-ris", name: "Pasir Ris", coordinate: { latitude: 1.373, longitude: 103.9493 } },
  { id: "paya-lebar", name: "Paya Lebar", coordinate: { latitude: 1.3147, longitude: 103.8931 } },
  { id: "pioneer", name: "Pioneer", coordinate: { latitude: 1.3376, longitude: 103.6974 } },
  {
    id: "potong-pasir",
    name: "Potong Pasir",
    coordinate: { latitude: 1.3344, longitude: 103.8591 },
  },
  { id: "punggol", name: "Punggol", coordinate: { latitude: 1.3984, longitude: 103.9072 } },
  { id: "queenstown", name: "Queenstown", coordinate: { latitude: 1.2942, longitude: 103.7861 } },
  { id: "rochor", name: "Rochor", coordinate: { latitude: 1.3047, longitude: 103.8519 } },
  { id: "seletar", name: "Seletar", coordinate: { latitude: 1.4149, longitude: 103.8778 } },
  { id: "serangoon", name: "Serangoon", coordinate: { latitude: 1.3508, longitude: 103.8723 } },
  { id: "sengkang", name: "Sengkang", coordinate: { latitude: 1.3868, longitude: 103.8935 } },
  { id: "sentosa", name: "Sentosa", coordinate: { latitude: 1.2494, longitude: 103.8303 } },
  { id: "sungei-road", name: "Sungei Road", coordinate: { latitude: 1.319, longitude: 103.8637 } },
  { id: "tampines", name: "Tampines", coordinate: { latitude: 1.3526, longitude: 103.9448 } },
  { id: "tanglin", name: "Tanglin", coordinate: { latitude: 1.3039, longitude: 103.8168 } },
  { id: "toa-payoh", name: "Toa Payoh", coordinate: { latitude: 1.3343, longitude: 103.8563 } },
  { id: "woodlands", name: "Woodlands", coordinate: { latitude: 1.4389, longitude: 103.7861 } },
  { id: "yishun", name: "Yishun", coordinate: { latitude: 1.4294, longitude: 103.8393 } },
] satisfies readonly { id: string; name: string; coordinate: Coordinate }[];

const SINGAPORE_AREAS = [...SINGAPORE_AREA_LIST].sort((left, right) =>
  left.name.localeCompare(right.name),
);

export function ManualLocationPickerScreen({ navigation, route }: Props) {
  const isSettingsMode = route.params?.mode === "settings";
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const setManualSelection = useLocationStore((state) => state.setManualSelection);
  const storedManualLocation = useLocationStore((state) => state.manualLocation);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const showToast = useUIStore((state) => state.showToast);
  const [query, setQuery] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(
    SINGAPORE_AREAS.find((area) => area.name.toLowerCase() === storedManualLocation?.toLowerCase())
      ?.id ?? null,
  );

  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);
  const filteredAreas = useMemo(
    () =>
      normalizedQuery.length === 0
        ? SINGAPORE_AREAS
        : SINGAPORE_AREAS.filter((area) => area.name.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery],
  );
  const selectedArea = SINGAPORE_AREAS.find((area) => area.id === selectedAreaId) ?? null;
  const showNoResults = normalizedQuery.length > 0 && filteredAreas.length === 0;

  const handleSubmit = () => {
    if (!selectedArea) return;
    setManualSelection(selectedArea.name, selectedArea.coordinate);
    // Already-onboarded users reach this picker from Discover, the map or
    // Settings; completing onboarding again would not change any state (so
    // nothing navigates home) and would re-fire onboarding_completed.
    if (isSettingsMode || hasCompletedOnboarding) {
      showToast({ message: `Location set to ${selectedArea.name}.`, tone: "success" });
      navigation.goBack();
      return;
    }
    // First run: RootNavigator moves on to Home once onboarding is complete.
    completeOnboarding(hasSkippedTasteQuiz);
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
