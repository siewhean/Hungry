import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
  type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Building2, Check, LocateFixed, MapPin, Search, X } from "lucide-react-native";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { SingaporeAreaMap } from "@/components/location/SingaporeAreaMap";
import { AppText, Button } from "@/components/ui";
import {
  AREA_SEARCH_MIN_CHARS,
  buildAreaSearchResults,
  nearestAreaName,
  type AreaSearchPlace,
  type AreaSearchResult,
} from "@/features/location/areaSearch";
import { planningAreasFor } from "@/features/location/singaporeAreaMap";
import { selectHaptic } from "@/lib/haptics";
import { searchOneMapAddresses, type OneMapAddress } from "@/lib/geo/oneMap";
import { reportError } from "@/lib/monitoring/reportError";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { OnboardingProgress, trackOnboardingAreaPickerViewed } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { SORTED_SINGAPORE_AREAS } from "./singaporeAreas";

type Props = NativeStackScreenProps<OnboardingStackParamList, "ManualLocationPicker">;

const SEARCH_DEBOUNCE_MS = 300;
// The field's rounded border already frames it; drop the browser's square focus outline.
const WEB_NO_OUTLINE = { outlineStyle: "none", outlineWidth: 0 } as unknown as TextStyle;

/**
 * Where the diner is, by search only: an area, a mall / hawker centre / food court, or an
 * address (shown as its area). There is no scrolling list to pick from.
 */
export function ManualLocationPickerScreen({ navigation, route }: Props) {
  const isSettingsMode = route.params?.mode === "settings";
  const { palette, radii, spacing } = useHungryTheme();
  const setManualSelection = useLocationStore((state) => state.setManualSelection);
  const clearManualLocation = useLocationStore((state) => state.clearManualLocation);
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const permission = useLocationStore((state) => state.permission);
  const hasCompletedOnboarding = useSessionStore((state) => state.hasCompletedOnboarding);
  const showToast = useUIStore((state) => state.showToast);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<{ query: string; items: AreaSearchPlace[] }>({
    query: "",
    items: [],
  });
  const [addresses, setAddresses] = useState<{ query: string; items: OneMapAddress[] }>({
    query: "",
    items: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<AreaSearchResult | null>(null);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const { width: windowWidth } = useWindowDimensions();
  const mapWidth = Math.min(windowWidth, 560) - spacing[4] * 2;
  const isOnboarding = !isSettingsMode && !hasCompletedOnboarding;
  const trimmedQuery = query.trim();

  // The search is a detour inside the Location step; the funnel should see it.
  useEffect(() => {
    if (isOnboarding) trackOnboardingAreaPickerViewed();
  }, [isOnboarding]);

  useEffect(() => {
    if (trimmedQuery.length < AREA_SEARCH_MIN_CHARS) {
      setIsSearching(false);
      return;
    }
    let active = true;
    setIsSearching(true);
    const timer = setTimeout(() => {
      const placeLookup = getCatalogRawService()
        .listPlaces({ query: trimmedQuery, limit: 5 })
        .then((items) => {
          if (active) setPlaces({ query: trimmedQuery, items });
        })
        .catch((error: unknown) => {
          reportError(error, { screen: "ManualLocationPicker", action: "listPlaces" });
        });
      const addressLookup = searchOneMapAddresses(trimmedQuery)
        .then((items) => {
          if (active) setAddresses({ query: trimmedQuery, items });
        })
        .catch(() => undefined); // Offline: areas and places still show.
      void Promise.allSettled([placeLookup, addressLookup]).then(() => {
        if (active) setIsSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  const results = useMemo(
    () =>
      trimmedQuery.length < AREA_SEARCH_MIN_CHARS
        ? []
        : buildAreaSearchResults({
            query: trimmedQuery,
            areas: SORTED_SINGAPORE_AREAS,
            places: places.query === trimmedQuery ? places.items : [],
            addresses: addresses.query === trimmedQuery ? addresses.items : [],
            areaForCoordinate: (coordinate) => nearestAreaName(coordinate, SORTED_SINGAPORE_AREAS),
          }),
    [addresses, places, trimmedQuery],
  );

  const finish = (message: string) => {
    // Already-onboarded users arrive from Discover, the map or Settings and go straight back.
    if (!isOnboarding) {
      showToast({ message, tone: "success" });
      navigation.goBack();
      return;
    }
    // First run: the location step is done; the optional taste quiz is next.
    navigation.navigate("TasteQuiz");
  };

  // A tap shows the choice on the map first; "Set as my location" saves it.
  const choose = (result: AreaSearchResult) => {
    selectHaptic();
    setSelected(result);
  };
  const confirm = () => {
    if (!selected) return;
    selectHaptic();
    setManualSelection(selected.areaName, selected.coordinate, selected.placeName);
    finish(`You are at ${selected.placeName ?? selected.areaName}.`);
  };
  const mapArea = selected
    ? planningAreasFor(selected.areaName, selected.coordinate)
    : manualLocation
      ? planningAreasFor(manualLocation, manualCoordinate ?? undefined)
      : [];
  const mapPin = selected && selected.kind !== "area" ? selected.coordinate : undefined;

  const chooseCurrentLocation = async () => {
    selectHaptic();
    if (permission === "granted") {
      await clearManualLocation();
      finish("Using your current location.");
      return;
    }
    const granted = await grantLocation();
    if (granted) {
      finish("Using your current location.");
      return;
    }
    showToast({
      message: "Location access is off. Search for an area instead.",
      tone: "info",
    });
  };

  const showNoResults =
    trimmedQuery.length >= AREA_SEARCH_MIN_CHARS && !isSearching && results.length === 0;

  return (
    <SafeAreaView
      style={{ backgroundColor: palette.bg, flex: 1 }}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={{ backgroundColor: palette.bg, flex: 1, paddingHorizontal: spacing[4] }}>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: spacing[2],
            paddingVertical: spacing[2],
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Returns to the previous screen without changing your location"
            onPress={() => navigation.goBack()}
            hitSlop={8}
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
          <View
            style={{
              alignItems: "center",
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.pill,
              borderWidth: 1,
              flex: 1,
              flexDirection: "row",
              gap: spacing[2],
              height: 48,
              paddingHorizontal: spacing[3],
            }}
          >
            <Search color={palette.textMuted} size={18} />
            <TextInput
              accessibilityLabel="Search for an area, mall, hawker centre or address"
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              onChangeText={setQuery}
              placeholder="Area, mall, hawker centre or address"
              placeholderTextColor={palette.textMuted}
              returnKeyType="search"
              style={[
                { color: palette.text, flex: 1, fontSize: 16, height: 46 },
                Platform.OS === "web" ? WEB_NO_OUTLINE : null,
              ]}
              value={query}
            />
            {isSearching ? <ActivityIndicator color={palette.orange} size="small" /> : null}
            {query.length > 0 && !isSearching ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={10}
                onPress={() => setQuery("")}
              >
                <X color={palette.textMuted} size={18} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {isOnboarding ? <OnboardingProgress step="location" /> : null}

        <ScrollView
          contentContainerStyle={{ gap: spacing[1], paddingBottom: spacing[6] }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ResultRow
            icon={<LocateFixed color={palette.orange} size={18} />}
            title="Use my current location"
            subtitle={
              permission === "granted" ? "Follows you as you move" : "Asks for location access"
            }
            accessibilityLabel="Use my current location"
            onPress={() => void chooseCurrentLocation()}
          />

          {results.map((result) => (
            <ResultRow
              key={result.key}
              icon={
                result.kind === "place" ? (
                  <Building2 color={palette.orange} size={18} />
                ) : (
                  <MapPin color={palette.orange} size={18} />
                )
              }
              title={result.title}
              subtitle={result.subtitle}
              accessibilityLabel={`Choose ${result.title}`}
              selected={selected?.key === result.key}
              onPress={() => choose(result)}
            />
          ))}

          {showNoResults ? (
            <AppText tone="secondary" style={{ paddingTop: spacing[4], textAlign: "center" }}>
              {`No areas or places match "${trimmedQuery}". Try a nearby MRT station or street.`}
            </AppText>
          ) : null}
        </ScrollView>

        <View style={{ alignItems: "center", gap: spacing[3], paddingBottom: spacing[3] }}>
          <SingaporeAreaMap width={mapWidth} highlighted={mapArea} pin={mapPin} />
          {selected ? (
            <View style={{ alignSelf: "stretch", gap: spacing[1] }}>
              <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
                {selected.placeName
                  ? `${selected.placeName}, ${selected.areaName}`
                  : selected.areaName}
              </AppText>
              <Button label="Set as my location" onPress={confirm} />
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  accessibilityLabel,
  selected = false,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  accessibilityLabel: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: selected ? palette.orangeLight : pressed ? palette.bgSoft : "transparent",
        borderRadius: radii.md,
        flexDirection: "row",
        gap: spacing[3],
        minHeight: 56,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[2],
      })}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.orangeLight,
          borderRadius: radii.pill,
          height: 36,
          justifyContent: "center",
          width: 36,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyBold" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      {selected ? <Check color={palette.orange} size={18} /> : null}
    </Pressable>
  );
}
