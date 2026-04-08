/**
 * BuildingDrillDownScreen
 *
 * Upgraded version using:
 * - Real SVG FloorPlanViewer (replaces the wireframe placeholder)
 * - Singapore buildings dataset for extended building details
 * - Stall tap → navigate to StallDetail
 * - Floor selector synced to store
 */

import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Search, MapPin, Clock, Star } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Badge, Card, EmptyState, Input, Screen } from "@/components/ui";
import { FloorPlanViewer } from "@/components/map/FloorPlanViewer";
import { getBuildingDishes, getBuildingVenues } from "@/features/discovery/discovery";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useHungryTheme } from "@/theme";
import { mockRepository } from "@/lib/services/mock/repositories";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import { getFloorPlan } from "@/lib/geo/floorPlans";
import type { StallPolygon } from "@/lib/services/types";

// ─── Stall Row ────────────────────────────────────────────────────────────────

function StallRow({
  venueId,
  isHighlighted,
  onPress,
}: {
  venueId: string;
  isHighlighted?: boolean;
  onPress: () => void;
}) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const venue = mockRepository.getVenueById(venueId);
  const topDish = venue ? mockRepository.getDishById(venue.topDishId) : undefined;

  if (!venue) return null;

  return (
    <Pressable onPress={onPress}>
      <Card
        style={Object.assign(
          { gap: 12 },
          isHighlighted
            ? { borderColor: palette.orange, borderWidth: 2, backgroundColor: palette.orangeLight }
            : {}
        )}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          {topDish ? (
            <Image
              source={{ uri: topDish.imageUrl }}
              style={{ width: 72, height: 72, borderRadius: 14 }}
              contentFit="cover"
            />
          ) : null}
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{venue.name}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {venue.floor} · {venue.unitNumber}
                </AppText>
              </View>
              <Badge
                label={`NEA ${venue.hygieneGrade}`}
                tone={venue.hygieneGrade === "A" ? "success" : "amber"}
              />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: venue.isOpen ? palette.success : palette.error,
                }}
              />
              <AppText variant="bodySmall" tone="secondary">
                {venue.isOpen ? venue.operatingHours : venue.closureNotice || "Closed today"}
              </AppText>
            </View>
            {topDish ? (
              <AppText variant="bodySmall" tone="secondary">
                Popular: {topDish.name} · {topDish.priceRange}
              </AppText>
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

// ─── Building Stats Row ───────────────────────────────────────────────────────

function BuildingStatRow({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  const { palette, spacing } = useHungryTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
      {icon}
      <AppText variant="bodySmall">
        <AppText variant="bodySmall" style={{ fontFamily: "Nunito_700Bold" }}>
          {value}
        </AppText>{" "}
        {label}
      </AppText>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function BuildingDrillDownScreen() {
  const navigation = useNavigation<any>();
  const { palette, radii, spacing } = useHungryTheme();
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const selectedFloor = useDiscoveryStore((state) => state.selectedFloor);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);
  const [stallQuery, setStallQuery] = useState("");
  const [highlightedStallVenueId, setHighlightedStallVenueId] = useState<
    string | undefined
  >();

  if (!selectedBuilding) {
    return (
      <Screen title="Building" subtitle="No building selected yet.">
        <EmptyState
          title="Pick a building first"
          body="Go back to Maps and tap any building pin."
        />
      </Screen>
    );
  }

  // Merge with extended SG data if available
  const sgBuilding = getBuildingById(selectedBuilding.id);

  const venues = getBuildingVenues(selectedBuilding.id);
  const floorVenues = useMemo(
    () =>
      venues.filter((venue) => {
        const matchesFloor = venue.floor === selectedFloor;
        const matchesQuery =
          stallQuery.trim().length === 0 ||
          `${venue.name} ${venue.unitNumber}`
            .toLowerCase()
            .includes(stallQuery.trim().toLowerCase());
        return matchesFloor && matchesQuery;
      }),
    [selectedFloor, stallQuery, venues]
  );

  const floorDishes = getBuildingDishes(selectedBuilding.id).filter((dish) =>
    floorVenues.some((venue) => venue.id === dish.venueId)
  );

  const heroDish = mockRepository.getDishById(selectedBuilding.heroDishId);

  // Get floor plan for current floor
  const floorPlan = useMemo(
    () =>
      getFloorPlan(
        selectedBuilding.id,
        selectedFloor,
        sgBuilding?.openStalls ?? venues.filter((v) => v.isOpen).length,
        sgBuilding?.totalStalls ?? venues.length
      ),
    [selectedBuilding.id, selectedFloor, sgBuilding, venues]
  );

  // Handle stall tap on floor plan
  const handleStallPress = (stall: StallPolygon) => {
    if (stall.venueId) {
      setHighlightedStallVenueId(stall.venueId);
      // Scroll to the stall in the list (future enhancement)
    }
  };

  const typeLabel =
    selectedBuilding.type === "food_court"
      ? "Food Court"
      : selectedBuilding.type === "hawker_centre"
      ? "Hawker Centre"
      : "Kopitiam";

  const typeTone =
    selectedBuilding.type === "food_court"
      ? "success"
      : selectedBuilding.type === "hawker_centre"
      ? "orange"
      : "neutral";

  return (
    <Screen
      title={selectedBuilding.name}
      subtitle={
        sgBuilding?.address
          ? `${sgBuilding.address} · S${sgBuilding.postalCode}`
          : "Tap a stall on the floor plan to jump to its details."
      }
    >
      <View style={{ gap: spacing[4] }}>
        {/* ── Hero Card ───────────────────────────────────── */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {heroDish ? (
            <Image
              source={{ uri: heroDish.imageUrl }}
              style={{ width: "100%", height: 160 }}
              contentFit="cover"
            />
          ) : null}
          <View style={{ padding: spacing[4], gap: spacing[3] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="h2">{selectedBuilding.name}</AppText>
                {sgBuilding?.description ? (
                  <AppText variant="bodySmall" tone="muted" numberOfLines={2}>
                    {sgBuilding.description}
                  </AppText>
                ) : null}
              </View>
              <Badge label={typeLabel} tone={typeTone} />
            </View>

            {/* Stats */}
            <View style={{ gap: spacing[2] }}>
              <BuildingStatRow
                icon={<Star size={14} color={palette.amber} />}
                value={sgBuilding?.avgRating?.toFixed(1) ?? "—"}
                label="avg rating"
              />
              <BuildingStatRow
                icon={<MapPin size={14} color={palette.textMuted} />}
                value={`${sgBuilding?.openStalls ?? venues.filter((v) => v.isOpen).length}`}
                label={`of ${sgBuilding?.totalStalls ?? selectedBuilding.venueCount} stalls open`}
              />
              {sgBuilding?.operatingHours ? (
                <BuildingStatRow
                  icon={<Clock size={14} color={palette.textMuted} />}
                  value=""
                  label={sgBuilding.operatingHours}
                />
              ) : null}
            </View>

            {/* Famous dishes chips */}
            {sgBuilding?.famousDishes?.length ? (
              <View>
                <AppText variant="micro" tone="muted" style={{ marginBottom: spacing[2] }}>
                  FAMOUS FOR
                </AppText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing[2] }}
                >
                  {sgBuilding.famousDishes.map((dish) => (
                    <Badge key={dish} label={dish} tone="orange" />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </Card>

        {/* ── Search ──────────────────────────────────────── */}
        <Input
          label="Search in this building"
          placeholder="Stall name or unit number…"
          value={stallQuery}
          onChangeText={setStallQuery}
          leftIcon={<Search color={palette.textMuted} size={18} />}
        />

        {/* ── Floor Selector ───────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2] }}
        >
          {selectedBuilding.floors.map((floor) => (
            <Pressable
              key={floor}
              onPress={() => {
                setSelectedFloor(floor);
                setHighlightedStallVenueId(undefined);
              }}
              style={{
                backgroundColor:
                  selectedFloor === floor ? palette.orange : palette.surfaceRaised,
                borderColor:
                  selectedFloor === floor ? palette.orange : palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[2],
                minHeight: 44,
                justifyContent: "center",
              }}
            >
              <AppText tone={selectedFloor === floor ? "inverse" : "secondary"}>
                {floor}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Floor Plan Viewer ─────────────────────────────── */}
        <Card style={{ gap: spacing[3], padding: 0, overflow: "hidden" }}>
          <View style={{ padding: spacing[4], paddingBottom: 0 }}>
            <AppText variant="h3">Floor Plan — {selectedFloor}</AppText>
            <AppText variant="bodySmall" tone="muted">
              Tap any stall to highlight it and jump to details below.
            </AppText>
          </View>
          <FloorPlanViewer
            floorPlan={floorPlan}
            onStallPress={handleStallPress}
            showLegend
            scale={1}
          />
        </Card>

        {/* ── Popular on this floor ────────────────────────── */}
        {floorDishes.length > 0 && (
          <View style={{ gap: spacing[3] }}>
            <AppText variant="h3">Popular on {selectedFloor}</AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing[3] }}
            >
              {floorDishes.slice(0, 4).map((dish) => (
                <Pressable
                  key={dish.id}
                  onPress={() =>
                    navigation
                      .getParent()
                      ?.getParent()
                      ?.navigate("DishDetail", { dishId: dish.id })
                  }
                  style={{ width: 196 }}
                >
                  <Card style={{ padding: 0, overflow: "hidden" }}>
                    <Image
                      source={{ uri: dish.imageUrl }}
                      style={{ width: "100%", height: 122 }}
                      contentFit="cover"
                    />
                    <View style={{ padding: spacing[3], gap: 4 }}>
                      <AppText variant="h3" numberOfLines={1}>
                        {dish.name}
                      </AppText>
                      <AppText variant="bodySmall" tone="secondary">
                        {dish.tasteTags.slice(0, 2).join(" · ")}
                      </AppText>
                      <AppText variant="price">S${dish.price.toFixed(2)}</AppText>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Stall List ───────────────────────────────────── */}
        <Card style={{ gap: spacing[3] }}>
          <AppText variant="h3">
            Stalls on {selectedFloor}{" "}
            <AppText variant="bodySmall" tone="muted">
              ({floorVenues.length})
            </AppText>
          </AppText>
          {floorVenues.length ? (
            <View style={{ gap: 12 }}>
              {floorVenues.map((item) => (
                <StallRow
                  key={item.id}
                  venueId={item.id}
                  isHighlighted={item.id === highlightedStallVenueId}
                  onPress={() =>
                    navigation
                      .getParent()
                      ?.getParent()
                      ?.navigate("StallDetail", { venueId: item.id })
                  }
                />
              ))}
            </View>
          ) : (
            <EmptyState
              title="No stalls match"
              body="Try a different floor or clear the search."
            />
          )}
        </Card>
      </View>
    </Screen>
  );
}
