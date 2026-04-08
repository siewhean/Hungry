/**
 * HomeMapScreen — upgraded
 *
 * Changes from v1:
 *  - Loads building pins from the full singaporeBuildings dataset (30+ buildings)
 *  - Region filter tabs (All / Central / North / East / West / NE)
 *  - Inline search bar filters both mock + SG data
 *  - Accurate open stall counts and operating hours from SG dataset
 *  - "Explore floor plan" CTA replaces "Zoom map"
 *  - Nearest-buildings geo sort when GPS is live
 */

import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import {
  Clock,
  Layers3,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  Star,
  Store,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Badge, Button, Card, EmptyState, Input, Screen } from "@/components/ui";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { useDiscoverData } from "@/features/discovery/discovery";
import {
  singaporeBuildings,
  getNearestBuildings,
  getBuildingsByRegion,
  type SingaporeRegion,
} from "@/lib/geo/singaporeBuildings";
import type { BuildingSummary } from "@/types/domain";

// ─── Region filter config ─────────────────────────────────────────────────────

const REGIONS: Array<{ label: string; value: SingaporeRegion | "all" }> = [
  { label: "All", value: "all" },
  { label: "Central", value: "central" },
  { label: "East", value: "east" },
  { label: "West", value: "west" },
  { label: "North", value: "north" },
  { label: "NE", value: "north_east" },
];

// ─── Map Pin ──────────────────────────────────────────────────────────────────

const PIN_POSITIONS: Array<{ top: `${number}%`; left: `${number}%` }> = [
  { top: "14%", left: "16%" },
  { top: "38%", left: "52%" },
  { top: "62%", left: "24%" },
  { top: "26%", left: "72%" },
  { top: "54%", left: "68%" },
  { top: "18%", left: "44%" },
  { top: "72%", left: "48%" },
  { top: "44%", left: "12%" },
];

function MapBuildingPin({
  building,
  index,
  isSelected,
  onPress,
}: {
  building: BuildingSummary;
  index: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const pinColor =
    building.type === "hawker_centre"
      ? palette.orange
      : building.type === "food_court"
        ? palette.success
        : palette.textMuted;

  const position = PIN_POSITIONS[index % PIN_POSITIONS.length];

  return (
    <Pressable
      onPress={onPress}
      style={[{ position: "absolute" }, position]}
      accessibilityLabel={`Building pin: ${building.name}`}
    >
      <View style={{ alignItems: "center", gap: 4 }}>
        <View
          style={[
            {
              alignItems: "center",
              backgroundColor: pinColor,
              borderRadius: radii.pill,
              height: isSelected ? 48 : 38,
              justifyContent: "center",
              width: isSelected ? 48 : 38,
              borderWidth: isSelected ? 2.5 : 0,
              borderColor: "#FFFFFF",
            },
            isSelected && shadows.floating,
          ]}
        >
          <MapPin color={palette.bg} size={isSelected ? 20 : 16} />
        </View>
        {isSelected && (
          <View
            style={{
              backgroundColor: pinColor,
              borderRadius: radii.pill,
              paddingHorizontal: spacing[2],
              paddingVertical: 2,
              maxWidth: 120,
            }}
          >
            <AppText
              variant="micro"
              style={{ color: "#FFFFFF", fontFamily: "Nunito_700Bold" }}
              numberOfLines={1}
            >
              {building.name}
            </AppText>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Building List Row ────────────────────────────────────────────────────────

function BuildingListRow({
  building,
  onPress,
}: {
  building: BuildingSummary & { operatingHours?: string; avgRating?: number; openStalls?: number };
  onPress: () => void;
}) {
  const { palette, spacing } = useHungryTheme();

  return (
    <Pressable onPress={onPress} accessibilityLabel={`Open ${building.name}`}>
      <Card>
        <View style={{ gap: spacing[2] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="h3" numberOfLines={1}>
                {building.name}
              </AppText>
              <AppText variant="bodySmall" tone="secondary">
                {building.venueCount} stalls · {building.floors.join(", ")}
              </AppText>
            </View>
            <View style={{ gap: 4, alignItems: "flex-end" }}>
              <Badge
                label={building.isClosedToday ? "Closed today" : "Open"}
                tone={building.isClosedToday ? "warning" : "success"}
              />
              <Badge
                label={
                  building.type === "food_court"
                    ? "Food Court"
                    : building.type === "hawker_centre"
                      ? "Hawker"
                      : "Kopitiam"
                }
                tone={
                  building.type === "food_court"
                    ? "success"
                    : building.type === "hawker_centre"
                      ? "orange"
                      : "neutral"
                }
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing[4] }}>
            {building.avgRating !== undefined && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Star size={13} color={palette.amber} />
                <AppText variant="bodySmall" tone="secondary">
                  {building.avgRating.toFixed(1)}
                </AppText>
              </View>
            )}
            {building.openStalls !== undefined && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Store size={13} color={palette.success} />
                <AppText variant="bodySmall" tone="secondary">
                  {building.openStalls} open
                </AppText>
              </View>
            )}
            {building.operatingHours && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Clock size={13} color={palette.textMuted} />
                <AppText variant="bodySmall" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                  {building.operatingHours}
                </AppText>
              </View>
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function HomeMapScreen() {
  useAppBootstrap();
  const navigation = useNavigation<any>();
  const { palette, radii, spacing } = useHungryTheme();

  const { buildings: mockBuildings } = useDiscoverData();
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const profile = useProfileStore((state) => state.profile);
  const gpsBadgeState = useLocationStore((state) => state.gpsBadgeState);
  const userLocation = useLocationStore((state) => state.currentLocation);
  const showToast = useUIStore((state) => state.showToast);

  const [regionFilter, setRegionFilter] = useState<SingaporeRegion | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Merge mock buildings + SG dataset (dedup by id)
  const allBuildings = useMemo(() => {
    const sgAsSummaries: Array<BuildingSummary & {
      operatingHours?: string;
      avgRating?: number;
      openStalls?: number;
    }> = singaporeBuildings.map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
      coordinate: b.coordinate,
      floors: b.floors,
      venueCount: b.venueCount,
      isClosedToday: b.isClosedToday,
      heroDishId: b.heroDishId ?? "",
      operatingHours: b.operatingHours,
      avgRating: b.avgRating,
      openStalls: b.openStalls,
    }));

    const mockIds = new Set(mockBuildings.map((b) => b.id));
    const uniqueSg = sgAsSummaries.filter((b) => !mockIds.has(b.id));
    return [...mockBuildings, ...uniqueSg];
  }, [mockBuildings]);

  // Filter by region then by search query
  const filteredBuildings = useMemo(() => {
    let list = allBuildings;

    if (regionFilter !== "all") {
      const regionIds = new Set(
        singaporeBuildings
          .filter((b) => b.region === regionFilter)
          .map((b) => b.id)
      );
      list = list.filter((b) => regionIds.has(b.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((b) =>
        b.name.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allBuildings, regionFilter, searchQuery]);

  // For the map pins, show top 8 buildings (nearest-first if GPS available)
  const mapPinBuildings = useMemo(() => {
    if (gpsBadgeState === "live" && userLocation) {
      return getNearestBuildings(
        userLocation.latitude,
        userLocation.longitude,
        10,
        8
      ).map((b) => ({
        id: b.id,
        name: b.name,
        type: b.type,
        coordinate: b.coordinate,
        floors: b.floors,
        venueCount: b.venueCount,
        isClosedToday: b.isClosedToday,
        heroDishId: b.heroDishId ?? "",
      }));
    }
    return filteredBuildings.slice(0, 8);
  }, [gpsBadgeState, userLocation, filteredBuildings]);

  const pickedDish = useMemo(
    () => mockRepository.getDecideForMe(profile.tasteVector),
    [profile.tasteVector]
  );

  const activeBuilding = selectedBuilding ?? mapPinBuildings[0];

  return (
    <Screen
      title="Map"
      subtitle="Tap a pin, browse floors, pick a stall."
      scroll={false}
      headerRight={
        <Badge
          label={
            gpsBadgeState === "live"
              ? "GPS live"
              : gpsBadgeState === "manual"
                ? "Manual"
                : "Location off"
          }
          tone={
            gpsBadgeState === "live"
              ? "success"
              : gpsBadgeState === "manual"
                ? "warning"
                : "error"
          }
        />
      }
    >
      <View style={{ flex: 1, gap: spacing[4] }}>
        {/* ── Search Bar ─────────────────────────────────── */}
        <Input
          label=""
          placeholder="Search buildings, hawker centres, malls…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search color={palette.textMuted} size={18} />}
        />

        {/* ── Region Filter ───────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2] }}
        >
          {REGIONS.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => setRegionFilter(r.value)}
              accessibilityLabel={`Filter by ${r.label}`}
              style={{
                backgroundColor:
                  regionFilter === r.value ? palette.orange : palette.surfaceRaised,
                borderColor:
                  regionFilter === r.value ? palette.orange : palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[2],
                minHeight: 36,
                justifyContent: "center",
              }}
            >
              <AppText
                variant="bodySmall"
                tone={regionFilter === r.value ? "inverse" : "secondary"}
                style={regionFilter === r.value ? { fontFamily: "Nunito_700Bold" } : {}}
              >
                {r.label}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Map Canvas ──────────────────────────────────── */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {/* Road wireframe */}
          <View
            style={{
              backgroundColor: `${palette.mapRoadSecondary}22`,
              height: 300,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Road lines */}
            {[
              { top: 60, left: 20, width: 180, rotate: "12deg" },
              { top: 130, right: 20, width: 150, rotate: "-18deg" },
              { bottom: 80, left: 30, width: 220, rotate: "0deg" },
              { top: 90, left: 110, width: 2, height: 160, isVertical: true },
            ].map((road, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  top: "top" in road ? road.top : undefined,
                  bottom: "bottom" in road ? road.bottom : undefined,
                  left: "left" in road ? road.left : undefined,
                  right: "right" in road ? road.right : undefined,
                  width: "isVertical" in road && road.isVertical ? 2 : road.width,
                  height: "isVertical" in road && road.isVertical ? road.height ?? 2 : 2,
                  backgroundColor: palette.mapRoadSecondary,
                  transform: "rotate" in road ? [{ rotate: road.rotate ?? "0deg" }] : [],
                }}
              />
            ))}

            {/* Building pins */}
            {mapPinBuildings.map((building, index) => (
              <MapBuildingPin
                key={building.id}
                building={building}
                index={index}
                isSelected={selectedBuilding?.id === building.id}
                onPress={() => {
                  setSelectedBuilding(building);
                  setSelectedFloor(building.floors[0]);
                }}
              />
            ))}

            {/* GPS badge */}
            {gpsBadgeState === "live" && (
              <View
                style={{
                  position: "absolute",
                  top: spacing[3],
                  right: spacing[3],
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: `${palette.success}CC`,
                  borderRadius: radii.pill,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 4,
                }}
              >
                <Navigation size={11} color="#FFFFFF" />
                <AppText variant="micro" style={{ color: "#FFFFFF" }}>
                  Live
                </AppText>
              </View>
            )}

            {/* Selected building card overlay */}
            {activeBuilding && (
              <View
                style={{
                  bottom: spacing[3],
                  left: spacing[3],
                  position: "absolute",
                  right: spacing[3],
                }}
              >
                <Card
                  style={{
                    gap: spacing[3],
                    padding: spacing[3],
                    backgroundColor: palette.surface,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="h3" numberOfLines={1}>
                        {activeBuilding.name}
                      </AppText>
                      <AppText variant="bodySmall" tone="secondary">
                        {activeBuilding.venueCount} stalls
                        {activeBuilding.floors.length > 1
                          ? ` · ${activeBuilding.floors.length} floors`
                          : ""}
                      </AppText>
                    </View>
                    <Badge
                      label={activeBuilding.type === "food_court" ? "Food Court" : "Hawker"}
                      tone={activeBuilding.type === "food_court" ? "success" : "orange"}
                    />
                  </View>

                  <View style={{ flexDirection: "row", gap: spacing[2] }}>
                    <Button
                      label="Explore floors"
                      fullWidth={false}
                      onPress={() => {
                        setSelectedBuilding(activeBuilding);
                        setSelectedFloor(activeBuilding.floors[0]);
                        navigation.navigate("BuildingDrillDown", {
                          buildingId: activeBuilding.id,
                        });
                      }}
                    />
                    <Button
                      label="Dish Roulette"
                      variant="secondary"
                      fullWidth={false}
                      onPress={() => {
                        if (!pickedDish) {
                          showToast({
                            message: "No dish matched your taste profile.",
                            tone: "warning",
                          });
                          return;
                        }
                        setDecideForMe(pickedDish);
                        navigation.navigate("DecideForMeResult");
                      }}
                    />
                  </View>
                </Card>
              </View>
            )}
          </View>

          {/* Legend */}
          <View
            style={{
              flexDirection: "row",
              gap: spacing[2],
              padding: spacing[3],
              borderTopWidth: 1,
              borderTopColor: palette.border,
            }}
          >
            <Badge label="Hawker" tone="orange" />
            <Badge label="Food Court" tone="success" />
            <AppText variant="micro" tone="muted" style={{ marginLeft: "auto" }}>
              {filteredBuildings.length} building{filteredBuildings.length !== 1 ? "s" : ""}
            </AppText>
          </View>
        </Card>

        {/* ── List View ───────────────────────────────────── */}
        <View style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <Layers3 color={palette.orange} size={18} />
            <AppText variant="h2">
              {regionFilter === "all"
                ? "All locations"
                : REGIONS.find((r) => r.value === regionFilter)?.label ?? "Buildings"}
            </AppText>
            <AppText variant="bodySmall" tone="muted">
              ({filteredBuildings.length})
            </AppText>
          </View>

          <FlatList
            data={filteredBuildings}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={{ gap: spacing[3], paddingBottom: 120 }}
            renderItem={({ item }) => (
              <BuildingListRow
                building={item as any}
                onPress={() => {
                  setSelectedBuilding(item);
                  setSelectedFloor(item.floors[0]);
                  navigation.navigate("BuildingDrillDown", { buildingId: item.id });
                }}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                title="No buildings found"
                body={
                  searchQuery
                    ? `No results for "${searchQuery}". Try a different keyword.`
                    : "No buildings in this region yet."
                }
              />
            }
          />
        </View>
      </View>
    </Screen>
  );
}
