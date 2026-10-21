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
import { OnboardingProgress, trackOnboardingAreaPickerViewed } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { useEffect, useMemo, useState } from "react";
import {
  ONBOARDING_ACTIONS_BOTTOM_PADDING,
  ONBOARDING_ACTIONS_GAP,
  ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
} from "./layoutConstants";

type Props = NativeStackScreenProps<OnboardingStackParamList, "ManualLocationPicker">;

type SingaporeArea = {
  id: string;
  name: string;
  /** Other names people search by (a neighbourhood inside the area, or the planning-area name). */
  keywords?: string[];
  coordinate: Coordinate;
};

const SINGAPORE_AREA_LIST: readonly SingaporeArea[] = [
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
  {
    id: "chinatown",
    name: "Chinatown",
    keywords: ["outram", "tanjong pagar"],
    coordinate: { latitude: 1.2836, longitude: 103.8436 },
  },
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
  { id: "sembawang", name: "Sembawang", coordinate: { latitude: 1.4491, longitude: 103.8185 } },
  { id: "sengkang", name: "Sengkang", coordinate: { latitude: 1.3868, longitude: 103.8935 } },
  { id: "sentosa", name: "Sentosa", coordinate: { latitude: 1.2494, longitude: 103.8303 } },
  {
    id: "sungei-road",
    name: "Sungei Road",
    keywords: ["jalan besar", "rochor"],
    coordinate: { latitude: 1.319, longitude: 103.8637 },
  },
  { id: "tampines", name: "Tampines", coordinate: { latitude: 1.3526, longitude: 103.9448 } },
  { id: "tanglin", name: "Tanglin", coordinate: { latitude: 1.3039, longitude: 103.8168 } },
  { id: "tengah", name: "Tengah", coordinate: { latitude: 1.368, longitude: 103.728 } },
  { id: "toa-payoh", name: "Toa Payoh", coordinate: { latitude: 1.3343, longitude: 103.8563 } },
  { id: "woodlands", name: "Woodlands", coordinate: { latitude: 1.4389, longitude: 103.7861 } },
  { id: "yishun", name: "Yishun", coordinate: { latitude: 1.4294, longitude: 103.8393 } },
];

const SINGAPORE_AREAS = [...SINGAPORE_AREA_LIST].sort((left, right) =>
  left.name.localeCompare(right.name),
);

export function ManualLocationPickerScreen({ navigation, route }: Props) {
  const isSettingsMode = route.params?.mode === "settings";
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const setManualSelection = useLocationStore((state) => state.setManualSelection);
  const storedManualLocation = useLocationStore((state) => state.manualLocation);
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
        : SINGAPORE_AREAS.filter(
            (area) =>
              area.name.toLowerCase().includes(normalizedQuery) ||
              area.keywords?.some((keyword) => keyword.includes(normalizedQuery)),
          ),
    [normalizedQuery],
  );
  const selectedArea = SINGAPORE_AREAS.find((area) => area.id === selectedAreaId) ?? null;
  const showNoResults = normalizedQuery.length > 0 && filteredAreas.length === 0;
  const isOnboarding = !isSettingsMode && !hasCompletedOnboarding;

  // The picker is a detour inside the Location step; the funnel should see it.
  useEffect(() => {
    if (isOnboarding) trackOnboardingAreaPickerViewed();
  }, [isOnboarding]);

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
          left={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint="Returns to the previous screen without changing your location"
              onPress={() => navigation.goBack()}
              style={{
                alignItems: "center",
                borderRadius: radii.pill,
                height: 44,
                justifyContent: "center",
                width: 44,
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
          // Status, not a control: a disabled button read as "dimmed" to screen readers.
          <View
            accessible
            accessibilityLabel={`Selected location: ${selectedArea.name}`}
            style={{
              alignItems: "center",
              alignSelf: "flex-start",
              backgroundColor: palette.orangeLight,
              borderRadius: radii.pill,
              flexDirection: "row",
              gap: spacing[1],
              marginTop: spacing[2],
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
            }}
          >
            <MapPin color={palette.orange} size={14} />
            <AppText variant="bodySmall" style={{ color: palette.orange }}>
              Selected: {selectedArea.name}
            </AppText>
          </View>
        ) : null}

        <View style={{ flex: 1, gap: spacing[2], paddingTop: spacing[3] }}>
          <ScrollView
            accessibilityRole="radiogroup"
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
                    accessibilityRole="radio"
                    accessibilityLabel={`Choose ${area.name}`}
                    accessibilityHint="Sets this as your Hungry discovery location"
                    accessibilityState={{ checked: area.id === selectedAreaId }}
                    onPress={() => {
                      setSelectedAreaId(area.id);
                    }}
                  >
                    <Card
                      style={{
                        borderRadius: radii.md,
                        justifyContent: "center",
                        minHeight: 48,
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
            label={isOnboarding ? "Continue" : "Save location"}
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
