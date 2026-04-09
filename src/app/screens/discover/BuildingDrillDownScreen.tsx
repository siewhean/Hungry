import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Minus, Plus, RotateCcw, Search, Store } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { FloorPlanViewer } from "@/components/map/FloorPlanViewer";
import { AppText, Button, Input } from "@/components/ui";
import { getBuildingVenues } from "@/features/discovery/discovery";
import { getFloorPlan } from "@/lib/geo/floorPlans";
import { getBuildingById, singaporeBuildings, toSummary } from "@/lib/geo/singaporeBuildings";
import { mockRepository } from "@/lib/services/mock/repositories";
import type { StallPolygon } from "@/lib/services/types";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "BuildingDrillDown">;

const DEFAULT_BUILDING_ID = "hc-maxwell";
const MAP_VIEWPORT_HEIGHT = 332;
const DIRECTORY_ZOOM_MIN = 0.16;
const DIRECTORY_ZOOM_MAX = 2.2;

const BUILDING_ID_ALIASES: Record<string, string[]> = {
  "building-maxwell": ["hc-maxwell"],
  "building-lau-pa-sat": ["hc-lau-pa-sat"],
  "building-amoy": ["hc-amoy"],
  "building-old-airport-road": ["hc-old-airport-road"],
  "building-tiong-bahru": ["hc-tiong-bahru"],
  "building-food-republic-wisma": ["fc-food-republic-wisma"],
  "building-koufu-jem": ["fc-koufu-jem"],
};

function normalizeBuildingName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveBuilding(buildingId?: string, selectedName?: string) {
  if (buildingId) {
    const direct = getBuildingById(buildingId);
    if (direct) {
      return direct;
    }

    for (const alias of BUILDING_ID_ALIASES[buildingId] ?? []) {
      const byAlias = getBuildingById(alias);
      if (byAlias) {
        return byAlias;
      }
    }
  }

  if (selectedName) {
    const normalizedTarget = normalizeBuildingName(selectedName);
    const byName = singaporeBuildings.find(
      (building) => normalizeBuildingName(building.name) === normalizedTarget,
    );
    if (byName) {
      return byName;
    }
  }

  return getBuildingById(DEFAULT_BUILDING_ID)!;
}

function isDessertDish(dishId?: string) {
  if (!dishId) {
    return false;
  }

  const dish = mockRepository.getDishById(dishId);
  if (!dish) {
    return false;
  }

  const haystack = `${dish.name} ${dish.tasteTags.join(" ")}`.toLowerCase();
  return ["dessert", "sweet", "cheng tng", "pancake", "ice", "toast", "kueh"].some((token) =>
    haystack.includes(token),
  );
}

function isDessertLabel(label: string) {
  const normalized = label.toLowerCase();
  return ["dessert", "ice", "cake", "sweet", "kueh", "pastry", "bakery"].some((token) =>
    normalized.includes(token),
  );
}

function FloorToggle({
  floor,
  selected,
  onPress,
}: {
  floor: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: selected ? palette.navy : palette.surface,
        borderColor: selected ? palette.navy : palette.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        minHeight: 36,
        minWidth: 44,
        justifyContent: "center",
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
      }}
    >
      <AppText variant="micro" style={{ color: selected ? palette.surface : palette.text }}>
        {floor}
      </AppText>
    </Pressable>
  );
}

function DirectoryFilter({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: selected ? palette.bgSoft : palette.surface,
        borderColor: selected ? palette.navy : palette.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
      }}
    >
      <AppText variant="micro" style={{ color: selected ? palette.navy : palette.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function StatusBadge({ isOpen }: { isOpen: boolean }) {
  const { palette, radii, spacing } = useHungryTheme();
  const statusColor = isOpen ? palette.success : palette.error;

  return (
    <View
      style={{
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing[1],
        paddingHorizontal: spacing[2],
        paddingVertical: 6,
      }}
    >
      <View
        style={{
          backgroundColor: statusColor,
          borderRadius: radii.pill,
          height: 7,
          width: 7,
        }}
      />
      <AppText variant="micro">{isOpen ? "Open" : "Closed"}</AppText>
    </View>
  );
}

function ZoomControlButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: ReactNode;
}) {
  const { palette, radii } = useHungryTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        height: 34,
        justifyContent: "center",
        width: 34,
      }}
    >
      {children}
    </Pressable>
  );
}

export function BuildingDrillDownScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const selectedFloor = useDiscoveryStore((state) => state.selectedFloor);
  const highlightedStallVenueId = useDiscoveryStore((state) => state.highlightedStallVenueId);
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);
  const setHighlightedStallVenueId = useDiscoveryStore((state) => state.setHighlightedStallVenueId);

  const [stallQuery, setStallQuery] = useState("");
  const [dessertsOnly, setDessertsOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [selectedStallId, setSelectedStallId] = useState<string | undefined>(undefined);

  const building = useMemo(
    () => resolveBuilding(route.params?.buildingId, selectedBuilding?.name),
    [route.params?.buildingId, selectedBuilding?.name],
  );

  useEffect(() => {
    setSelectedBuilding(toSummary(building));
    if (!building.floors.includes(selectedFloor)) {
      setSelectedFloor(building.floors[0]);
    }
  }, [building, selectedFloor, setSelectedBuilding, setSelectedFloor]);

  const activeFloor = building.floors.includes(selectedFloor) ? selectedFloor : building.floors[0];

  const buildingVenues = useMemo(() => getBuildingVenues(building.id), [building.id]);
  const venueById = useMemo(() => new Map(buildingVenues.map((venue) => [venue.id, venue])), [buildingVenues]);

  const floorPlan = useMemo(
    () => getFloorPlan(building.id, activeFloor, building.openStalls, building.totalStalls),
    [activeFloor, building.id, building.openStalls, building.totalStalls],
  );
  const mapViewportWidth = useMemo(
    () => Math.max(220, windowWidth - spacing[5] * 2 - 2),
    [spacing, windowWidth],
  );
  const fittedDirectoryScale = useMemo(() => {
    const fitHorizontal = (mapViewportWidth - 24) / floorPlan.canvasWidth;
    const fitVertical = (MAP_VIEWPORT_HEIGHT - 24) / floorPlan.canvasHeight;
    const fitScale = Math.min(fitHorizontal, fitVertical);
    return Number(
      Math.max(DIRECTORY_ZOOM_MIN, Math.min(1, fitScale)).toFixed(3),
    );
  }, [floorPlan.canvasHeight, floorPlan.canvasWidth, mapViewportWidth]);
  const [directoryScale, setDirectoryScale] = useState(fittedDirectoryScale);
  const tenantPolygons = useMemo(
    () => floorPlan.stalls.filter((stall) => (stall.kind ?? "tenant") === "tenant"),
    [floorPlan.stalls],
  );

  useEffect(() => {
    setDirectoryScale(fittedDirectoryScale);
  }, [fittedDirectoryScale, activeFloor, building.id]);

  const floorDirectory = useMemo(() => {
    const query = stallQuery.trim().toLowerCase();

    return tenantPolygons
      .map((stall) => {
        const venue = stall.venueId ? venueById.get(stall.venueId) : undefined;
        const dish = venue ? mockRepository.getDishById(venue.topDishId) : undefined;
        const title = venue?.name ?? stall.label ?? `Unit ${stall.unitNumber}`;
        const unitNumber = venue?.unitNumber ?? stall.unitNumber;
        const isOpen = venue ? venue.isOpen : stall.status === "open";
        const descriptor = venue
          ? `${venue.operatingHours} · Hygiene ${venue.hygieneGrade}`
          : stall.status === "non_food"
            ? "Facility / seating"
            : "Independent unit";
        const searchable = `${title} ${unitNumber} ${dish?.name ?? ""}`.toLowerCase();

        return {
          stall,
          venue,
          dish,
          title,
          unitNumber,
          isOpen,
          descriptor,
          searchable,
        };
      })
      .filter((record) => {
        if (openNowOnly && !record.isOpen) {
          return false;
        }

        if (dessertsOnly) {
          const isDessert = isDessertDish(record.venue?.topDishId) || isDessertLabel(record.title);
          if (!isDessert) {
            return false;
          }
        }

        if (query && !record.searchable.includes(query)) {
          return false;
        }

        return true;
      });
  }, [dessertsOnly, openNowOnly, stallQuery, tenantPolygons, venueById]);

  const selectedFromStore = useMemo(
    () => tenantPolygons.find((stall) => stall.venueId === highlightedStallVenueId)?.stallId,
    [highlightedStallVenueId, tenantPolygons],
  );

  useEffect(() => {
    if (selectedFromStore) {
      setSelectedStallId(selectedFromStore);
      return;
    }

    if (!floorDirectory.some((record) => record.stall.stallId === selectedStallId)) {
      setSelectedStallId(floorDirectory[0]?.stall.stallId);
    }
  }, [floorDirectory, selectedFromStore, selectedStallId]);

  const activeStallId = selectedFromStore ?? selectedStallId;
  const selectedRecord = floorDirectory.find((record) => record.stall.stallId === activeStallId);

  const menuPreview = useMemo(
    () =>
      floorDirectory
        .map((record) => record.dish)
        .filter((dish): dish is DishDetail => Boolean(dish))
        .slice(0, 4),
    [floorDirectory],
  );

  const handleFloorChange = (floor: string) => {
    setSelectedFloor(floor);
    setSelectedStallId(undefined);
    setHighlightedStallVenueId(undefined);
  };

  const zoomInDirectory = () => {
    setDirectoryScale((current) =>
      Math.min(
        DIRECTORY_ZOOM_MAX,
        Number((current * 1.2).toFixed(3)),
      ),
    );
  };

  const zoomOutDirectory = () => {
    setDirectoryScale((current) =>
      Math.max(
        DIRECTORY_ZOOM_MIN,
        Number((current / 1.2).toFixed(3)),
      ),
    );
  };

  const resetDirectoryZoom = () => {
    setDirectoryScale(fittedDirectoryScale);
  };

  const zoomPercent = Math.max(
    10,
    Math.round((directoryScale / Math.max(fittedDirectoryScale, 0.0001)) * 100),
  );

  const handleStallSelection = (stall: StallPolygon) => {
    if ((stall.kind ?? "tenant") !== "tenant") {
      return;
    }

    setSelectedStallId(stall.stallId);
    setHighlightedStallVenueId(stall.venueId);
  };

  const openSelectedStall = () => {
    if (!selectedRecord?.venue) {
      return;
    }

    navigation.navigate("StallDetail", { venueId: selectedRecord.venue.id });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[3],
            paddingBottom: Math.max(insets.bottom + 132, spacing[12]),
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: spacing[4] }}>
            <View style={{ gap: spacing[1] }}>
              <AppText variant="bodySmall" tone="muted">
                Building directory
              </AppText>
              <AppText variant="h1">{building.name}</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Browse realistic floor overlays, select a unit polygon, then open the stall details.
              </AppText>
            </View>

            <Input
              label=""
              placeholder="Search unit, stall, or dish"
              value={stallQuery}
              onChangeText={setStallQuery}
              leftIcon={<Search color={palette.textMuted} size={18} />}
            />

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              <DirectoryFilter
                label="Open now"
                selected={openNowOnly}
                onPress={() => setOpenNowOnly((current) => !current)}
              />
              <DirectoryFilter
                label="Desserts"
                selected={dessertsOnly}
                onPress={() => setDessertsOnly((current) => !current)}
              />
            </View>

            <View
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: 24,
                borderWidth: 1,
                overflow: "hidden",
              }}
            >
              <View style={{ gap: 4, paddingHorizontal: spacing[4], paddingTop: spacing[4] }}>
                <AppText variant="h3">Store directory map</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Floor {activeFloor} · tap a stall polygon to inspect that unit.
                </AppText>
              </View>

              <View style={styles.mapViewport}>
                <FloorPlanViewer
                  floorPlan={floorPlan}
                  selectedStallId={activeStallId}
                  onStallPress={handleStallSelection}
                  scale={directoryScale}
                  showLegend={false}
                  showStatsBar={false}
                  viewportHeight={MAP_VIEWPORT_HEIGHT}
                />

                <View
                  style={[
                    styles.zoomPill,
                    {
                      backgroundColor: "rgba(255,255,255,0.96)",
                      borderColor: palette.border,
                      borderRadius: radii.lg,
                      padding: spacing[1],
                      left: spacing[3],
                      top: spacing[3],
                    },
                    shadows.floating,
                  ]}
                >
                  <ZoomControlButton onPress={zoomOutDirectory}>
                    <Minus color={palette.navy} size={15} />
                  </ZoomControlButton>
                  <ZoomControlButton onPress={resetDirectoryZoom}>
                    <RotateCcw color={palette.navy} size={14} />
                  </ZoomControlButton>
                  <ZoomControlButton onPress={zoomInDirectory}>
                    <Plus color={palette.navy} size={15} />
                  </ZoomControlButton>
                  <AppText variant="micro" style={{ color: palette.textMuted }}>
                    {zoomPercent}%
                  </AppText>
                </View>

                <View
                  style={[
                    styles.levelPill,
                    {
                      backgroundColor: "rgba(255,255,255,0.96)",
                      borderColor: palette.border,
                      borderRadius: radii.lg,
                      padding: spacing[1],
                      right: spacing[3],
                      top: spacing[3],
                    },
                    shadows.floating,
                  ]}
                >
                  {building.floors.map((floor) => (
                    <FloorToggle
                      key={floor}
                      floor={floor}
                      selected={floor === activeFloor}
                      onPress={() => handleFloorChange(floor)}
                    />
                  ))}
                </View>
              </View>
            </View>

            {selectedRecord ? (
              <View
                style={{
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderRadius: 22,
                  borderWidth: 1,
                  gap: spacing[3],
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[4],
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[3] }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText variant="h3">{selectedRecord.title}</AppText>
                    <AppText variant="bodySmall" tone="secondary">
                      {selectedRecord.unitNumber} · {selectedRecord.descriptor}
                    </AppText>
                  </View>
                  <StatusBadge isOpen={selectedRecord.isOpen} />
                </View>

                {selectedRecord.dish ? (
                  <AppText variant="bodySmall" tone="secondary">
                    {selectedRecord.dish.name} · S${selectedRecord.dish.price.toFixed(2)}
                  </AppText>
                ) : null}

                <View style={{ flexDirection: "row", gap: spacing[2] }}>
                  <Button
                    label="Open stall details"
                    onPress={openSelectedStall}
                    disabled={!selectedRecord.venue}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Highlight in list"
                    variant="secondary"
                    onPress={() => setSelectedStallId(selectedRecord.stall.stallId)}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : null}

            <View style={{ gap: spacing[2] }}>
              <AppText variant="h3">Stall directory · {activeFloor}</AppText>

              {floorDirectory.map((record) => {
                const isSelected = activeStallId === record.stall.stallId;

                return (
                  <Pressable
                    key={record.stall.stallId}
                    onPress={() => handleStallSelection(record.stall)}
                    style={{
                      backgroundColor: palette.surface,
                      borderColor: isSelected ? palette.orange : palette.border,
                      borderRadius: 18,
                      borderWidth: 1,
                      gap: 4,
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[3],
                    }}
                  >
                    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText variant="h3">{record.title}</AppText>
                        <AppText variant="bodySmall" tone="secondary">
                          {record.unitNumber} · {record.descriptor}
                        </AppText>
                      </View>
                      {record.venue ? <Store color={palette.textMuted} size={15} /> : null}
                    </View>
                  </Pressable>
                );
              })}

              {floorDirectory.length === 0 ? (
                <View
                  style={{
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: 18,
                    borderWidth: 1,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[4],
                  }}
                >
                  <AppText variant="h3">No units match this filter</AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    Clear the search or switch levels to inspect more units.
                  </AppText>
                </View>
              ) : null}
            </View>

            {menuPreview.length > 0 ? (
              <View
                style={{
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderRadius: 22,
                  borderWidth: 1,
                  gap: spacing[3],
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[4],
                }}
              >
                <AppText variant="h3">Menu preview on this level</AppText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing[3] }}
                >
                  {menuPreview.map((dish) => (
                    <Pressable
                      key={dish.id}
                      onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                      style={{
                        backgroundColor: palette.bgSoft,
                        borderColor: palette.border,
                        borderRadius: 16,
                        borderWidth: 1,
                        gap: 3,
                        minWidth: 164,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[3],
                      }}
                    >
                      <AppText variant="h3" numberOfLines={1}>
                        {dish.name}
                      </AppText>
                      <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                        {dish.venueName}
                      </AppText>
                      <AppText variant="price" style={{ color: palette.orange }}>
                        S${dish.price.toFixed(2)}
                      </AppText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View
          style={[
            styles.bottomDock,
            {
              backgroundColor: "rgba(255,255,255,0.98)",
              borderColor: palette.border,
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              paddingHorizontal: spacing[5],
              paddingTop: spacing[3],
            },
            shadows.floating,
          ]}
        >
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <Button
              label="Back to map"
              variant="secondary"
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                  return;
                }
                navigation.navigate("MainTabs", { screen: "Maps" });
              }}
              style={{ flex: 1 }}
            />
            <Button
              label="Open selected stall"
              onPress={openSelectedStall}
              disabled={!selectedRecord?.venue}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  mapViewport: {
    marginTop: 12,
    position: "relative",
  },
  zoomPill: {
    alignItems: "center",
    gap: 6,
    position: "absolute",
  },
  levelPill: {
    position: "absolute",
    gap: 6,
  },
  bottomDock: {
    borderTopWidth: 1,
  },
});
