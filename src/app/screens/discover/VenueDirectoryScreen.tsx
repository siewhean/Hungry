import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Info, MapPin } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Badge, EmptyState } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { SkiaFloorplanViewer } from "@/components/map/SkiaFloorplanViewer";
import { MAXWELL_L1_FLOOR_PLAN } from "@/lib/geo/maxwell_floorplan";
import { useUIStore } from "@/store/useUIStore";

type Props = NativeStackScreenProps<RootStackParamList, "VenueDirectory">;

export function VenueDirectoryScreen({ route, navigation }: Props) {
  const { venueId: routeParamId } = route.params;
  const insets = useSafeAreaInsets();
  const { componentRadii, palette, spacing, radii, shadows } = useHungryTheme();
  const repository = getDataRepository();
  const showToast = useUIStore((state) => state.showToast);

  const buildingId = useMemo(() => {
    if (getBuildingById(routeParamId)) {
      return routeParamId;
    }
    return repository.getVenueById(routeParamId)?.buildingId ?? routeParamId;
  }, [repository, routeParamId]);

  const building = useMemo(() => getBuildingById(buildingId), [buildingId]);
  const floors = building?.floors || [];
  const [selectedFloor, setSelectedFloor] = useState(floors[0]);

  const stallsOnFloor = useMemo(() => {
    if (!building || !selectedFloor) return [];

    const liveVenues = repository
      .listVenuesByBuilding(buildingId)
      .filter((v) => v.floor === selectedFloor);
    if (liveVenues.length > 0) {
      return liveVenues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        unitNumber: venue.unitNumber,
        venueId: venue.id,
      }));
    }

    if (
      (building.id === "hc-maxwell" || building.id === "building-maxwell") &&
      selectedFloor === "L1"
    ) {
      return MAXWELL_L1_FLOOR_PLAN.stalls
        .filter((stall) => (stall.kind ?? "tenant") === "tenant")
        .map((stall) => ({
          id: stall.stallId,
          name: stall.label ?? stall.unitNumber,
          unitNumber: stall.unitNumber,
          venueId: stall.venueId,
        }));
    }

    return [];
  }, [building, selectedFloor, repository, buildingId]);

  if (!building) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <AppText>Building not found</AppText>
        <Button label="Go Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const handleStallPress = (stallId: string) => {
    navigation.navigate("StallDetail", { venueId: stallId });
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing[2], backgroundColor: palette.surface },
        ]}
      >
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft color={palette.text} size={24} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <AppText variant="h2" numberOfLines={1}>
              {building.name}
            </AppText>
            <View style={styles.locationRow}>
              <MapPin size={12} color={palette.textMuted} />
              <AppText variant="micro" tone="secondary" numberOfLines={1}>
                {building.address}
              </AppText>
            </View>
          </View>
          <Badge label={building.type.replace("_", " ")} tone="info" />
        </View>

        {/* Floor Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.floorSelector, { paddingHorizontal: spacing[4] }]}
        >
          {floors.map((floor) => (
            <Pressable
              key={floor}
              onPress={() => setSelectedFloor(floor)}
              style={[
                styles.floorChip,
                {
                  backgroundColor: selectedFloor === floor ? palette.orange : palette.bgSoft,
                  borderRadius: radii.pill,
                },
              ]}
            >
              <AppText
                variant="bodySmall"
                style={{
                  color: selectedFloor === floor ? palette.surface : palette.text,
                  fontWeight: selectedFloor === floor ? "800" : "600",
                }}
              >
                Level {floor.replace("L", "")}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }}>
        <View style={{ padding: spacing[4], gap: spacing[4] }}>
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: palette.surface,
                borderRadius: componentRadii.card,
                ...shadows.card,
              },
            ]}
          >
            <View style={{ flexDirection: "row", gap: spacing[2], alignItems: "center" }}>
              <Info size={16} color={palette.orange} />
              <AppText variant="bodySmall" style={{ fontWeight: "700" }}>
                Indoor Directory (Beta)
              </AppText>
            </View>
            <AppText variant="micro" tone="secondary">
              Tap on any stall polygon to view details. Colors represent live opening status.
            </AppText>
          </View>

          {selectedFloor && (
            <SkiaFloorplanViewer
              buildingId={building.id}
              floor={selectedFloor}
              onStallPress={handleStallPress}
            />
          )}

          <View style={styles.legend}>
            <LegendItem color="#10B981" label="Open" />
            <LegendItem color="#F59E0B" label="Closing Soon" />
            <LegendItem color="#EF4444" label="Closed" />
            <LegendItem color="#E5E7EB" label="Non-Food" />
          </View>

          <View style={{ gap: spacing[3] }}>
            <AppText variant="h3">Stalls on this floor</AppText>
            {stallsOnFloor.length ? (
              stallsOnFloor.map((stall) => (
                <Pressable
                  key={stall.id}
                  onPress={() => {
                    if (stall.venueId) {
                      navigation.navigate("StallDetail", { venueId: stall.venueId });
                      return;
                    }
                    showToast({
                      message: "Stall details are not mapped yet for this unit.",
                      tone: "info",
                    });
                  }}
                  style={[
                    styles.stallRow,
                    { backgroundColor: palette.surface, borderRadius: radii.md },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="body">{stall.name}</AppText>
                    <AppText variant="micro" tone="secondary">
                      {stall.unitNumber}
                    </AppText>
                  </View>
                  <ChevronRight size={16} color={palette.border} />
                </Pressable>
              ))
            ) : (
              <EmptyState
                title="No stalls on this floor"
                body="No stall directory data is available for this floor yet."
                icon={<MapPin size={36} color={palette.textMuted} />}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  const { spacing } = useHungryTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: spacing[3] }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <AppText variant="micro" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

function ChevronRight({ size, color }: { size: number; color: string }) {
  return (
    <View style={{ transform: [{ rotate: "0deg" }] }}>
      <Info size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  floorSelector: {
    gap: 8,
  },
  floorChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  infoCard: {
    padding: 12,
    gap: 4,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 8,
  },
  stallRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
});
