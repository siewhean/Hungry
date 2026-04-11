import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, Search, Star, Utensils } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { FloorPlanViewer } from "@/components/map/FloorPlanViewer";
import { AppText, Button, Input } from "@/components/ui";
import { getBuildingVenues } from "@/features/discovery/discovery";
import { getDirectoryDescriptor } from "@/features/discovery/venueDescriptor";
import { getFloorPlan } from "@/lib/geo/floorPlans";
import { getBuildingById, singaporeBuildings, toSummary } from "@/lib/geo/singaporeBuildings";
import { mockRepository } from "@/lib/services/mock/repositories";
import type { StallPolygon } from "@/lib/services/types";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "BuildingDrillDown">;

const DEFAULT_BUILDING_ID = "hc-maxwell";
const MAP_VIEWPORT_HEIGHT = 220;
const DIRECTORY_ZOOM_MIN = 0.16;
const DIRECTORY_ZOOM_MAX = 2.2;

function resolveBuilding(buildingId?: string, selectedName?: string) {
  if (buildingId) {
    const direct = getBuildingById(buildingId);
    if (direct) return direct;
  }
  if (selectedName) {
    const byName = singaporeBuildings.find(b => b.name === selectedName);
    if (byName) return byName;
  }
  return getBuildingById(DEFAULT_BUILDING_ID)!;
}

function isDessertDish(dishName: string) {
  const haystack = dishName.toLowerCase();
  return ["dessert", "sweet", "cheng tng", "pancake", "ice", "toast", "kueh"].some(t => haystack.includes(t));
}

type VenueStatus = "open" | "closing_soon" | "closed";

function getVenueStatus(isOpen: boolean, operatingHours?: string): VenueStatus {
  if (!isOpen) return "closed";
  return "open"; // Simplified for layout match
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

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["40%", "90%"], []);

  const [stallQuery, setStallQuery] = useState("");
  const building = useMemo(() => resolveBuilding(route.params?.buildingId, selectedBuilding?.name), [route.params?.buildingId, selectedBuilding?.name]);

  useEffect(() => {
    setSelectedBuilding(toSummary(building));
    if (!building.floors.includes(selectedFloor)) setSelectedFloor(building.floors[0]);
  }, [building, selectedFloor, setSelectedBuilding, setSelectedFloor]);

  const activeFloor = building.floors.includes(selectedFloor) ? selectedFloor : building.floors[0];
  const buildingVenues = useMemo(() => getBuildingVenues(building.id), [building.id]);
  const venueById = useMemo(() => new Map(buildingVenues.map(v => [v.id, v])), [buildingVenues]);

  const floorPlan = useMemo(() => getFloorPlan(building.id, activeFloor, building.openStalls, building.totalStalls), [activeFloor, building.id]);
  const tenantPolygons = useMemo(() => floorPlan.stalls.filter(s => (s.kind ?? "tenant") === "tenant"), [floorPlan.stalls]);

  const floorDirectory = useMemo(() => {
    const query = stallQuery.trim().toLowerCase();
    return tenantPolygons.map(stall => {
      const venue = stall.venueId ? venueById.get(stall.venueId) : undefined;
      const dish = venue ? mockRepository.getDishById(venue.topDishId) : undefined;
      const title = venue?.name ?? stall.label ?? `Unit ${stall.unitNumber}`;
      return { stall, venue, dish, title, isOpen: venue?.isOpen ?? stall.status === "open", searchable: `${title} ${dish?.name ?? ""}`.toLowerCase() };
    }).filter(r => r.venue && (!query || r.searchable.includes(query)));
  }, [stallQuery, tenantPolygons, venueById]);

  const handleStallSelection = (stall: StallPolygon) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFloor(activeFloor); // Ensure we stay on floor
    setHighlightedStallVenueId(stall.venueId);
    bottomSheetModalRef.current?.present();
  };

  const activeRecord = useMemo(() => floorDirectory.find(r => r.stall.venueId === highlightedStallVenueId), [floorDirectory, highlightedStallVenueId]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Hero Image Section */}
      <View style={{ height: 200, width: "100%", position: "relative" }}>
        <Image source={{ uri: "https://images.unsplash.com/photo-1555392858-45cbb51dd14e?auto=format&fit=crop&w=800&q=80" }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.4)", "transparent", "rgba(0,0,0,0.8)"]} style={StyleSheet.absoluteFill} />
        
        {/* Back Button */}
        <Pressable 
          onPress={() => navigation.goBack()} 
          style={{ position: "absolute", top: insets.top + 10, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" }}
        >
          <ChevronLeft color="#FFFFFF" size={24} />
        </Pressable>

        {/* Building Info Overlay */}
        <View style={{ position: "absolute", bottom: 16, left: 16, right: 16 }}>
          <AppText variant="h2" tone="inverse">{building.name}</AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
            <AppText variant="micro" style={{ color: "rgba(255,255,255,0.8)" }}>1 Kadayanallur St · {building.totalStalls} stalls</AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Star color="#F59E0B" fill="#F59E0B" size={12} />
              <AppText variant="micro" style={{ color: "rgba(255,255,255,0.9)", fontWeight: "700" }}>4.6</AppText>
            </View>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Input 
          placeholder="Find a stall or dish here…" 
          value={stallQuery} 
          onChangeText={setStallQuery} 
          leftIcon={<Search color={palette.textMuted} size={18} />} 
        />
      </View>

      {/* Floor Selector Tab Strip */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {building.floors.map(f => {
            const selected = f === activeFloor;
            return (
              <Pressable 
                key={f} 
                onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedFloor(f); }}
                style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: selected ? palette.orange : "transparent" }}
              >
                <AppText style={{ color: selected ? palette.orange : palette.textSecondary, fontWeight: selected ? "700" : "400" }}>{f}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Floor Map Section */}
        <View style={{ padding: 16 }}>
          <AppText variant="h3" style={{ marginBottom: 8 }}>{activeFloor} Floor Plan</AppText>
          <View style={{ backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.border, overflow: "hidden" }}>
            <FloorPlanViewer
              floorPlan={floorPlan}
              selectedStallId={tenantPolygons.find(p => p.venueId === highlightedStallVenueId)?.stallId}
              onStallPress={handleStallSelection}
              scale={0.8}
              showLegend={false}
              viewportHeight={MAP_VIEWPORT_HEIGHT}
            />
          </View>
        </View>

        {/* Stall List */}
        <View style={{ paddingHorizontal: 16 }}>
          <AppText variant="h3" style={{ marginBottom: 12 }}>Stalls on {activeFloor}</AppText>
          <View style={{ gap: 8 }}>
            {floorDirectory.map(r => (
              <Pressable
                key={r.stall.stallId}
                onPress={() => handleStallSelection(r.stall)}
                style={[
                  shadows.card,
                  { backgroundColor: palette.surface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: highlightedStallVenueId === r.venue?.id ? 1 : 0, borderColor: palette.orange }
                ]}
              >
                <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.orange }}>
                  <Utensils color={palette.orange} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodySmall" style={{ fontWeight: "700" }}>{r.title}</AppText>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: r.isOpen ? palette.success : palette.error }} />
                    <AppText variant="micro" tone="secondary">{r.isOpen ? "Open" : "Closed"} · #{r.stall.unitNumber} · Local</AppText>
                  </View>
                </View>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }}>
                  <AppText style={{ fontSize: 10, fontWeight: "700" }}>A</AppText>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Detail Bottom Sheet */}
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={props => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />}
        backgroundStyle={{ backgroundColor: palette.surface }}
      >
        <BottomSheetScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20, gap: 16 }}>
          {activeRecord?.venue ? (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="micro" tone="secondary">{activeRecord.stall.unitNumber} · {activeFloor}</AppText>
                  <AppText variant="h1">{activeRecord.title}</AppText>
                </View>
                <Button label="View full" variant="primary" onPress={() => { bottomSheetModalRef.current?.dismiss(); navigation.navigate("StallDetail", { venueId: activeRecord.venue!.id }); }} />
              </View>
              {activeRecord.dish && (
                <Pressable 
                  onPress={() => { bottomSheetModalRef.current?.dismiss(); navigation.navigate("DishDetail", { dishId: activeRecord.dish!.id }); }}
                  style={{ backgroundColor: palette.bgSoft, padding: 16, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: palette.border }}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3">{activeRecord.dish.name}</AppText>
                    <AppText variant="price" style={{ color: palette.orange }}>S${activeRecord.dish.price.toFixed(2)}</AppText>
                  </View>
                  <ChevronRight color={palette.textMuted} size={20} />
                </Pressable>
              )}
            </>
          ) : (
            <View style={{ alignItems: "center", gap: spacing[4], paddingVertical: spacing[8] }}>
              <Utensils color={palette.border} size={48} />
              <AppText style={{ textAlign: "center", color: palette.textMuted }}>No stall selected</AppText>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({});
