import { useMemo, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Search, Star } from "lucide-react-native";
import { Image } from "expo-image";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { FloorPlanViewer } from "@/components/map/FloorPlanViewer";
import { AppText, Card, Input, Screen } from "@/components/ui";
import { getBuildingVenues } from "@/features/discovery/discovery";
import { getFloorPlan } from "@/lib/geo/floorPlans";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "BuildingDrillDownV2">;

const HERO_HEIGHT = 180;

export function BuildingDrillDownScreenV2({ route, navigation }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const repository = getDataRepository();
  const { componentRadii, palette, radii, spacing, shadows } = useHungryTheme();

  const buildingId = route.params?.buildingId ?? "hc-maxwell";
  const building = useMemo(() => getBuildingById(buildingId)!, [buildingId]);

  const selectedFloorFromStore = useDiscoveryStore((state) => state.selectedFloor);
  const [activeFloor, setActiveFloor] = useState(
    building.floors.includes(selectedFloorFromStore) ? selectedFloorFromStore : building.floors[0],
  );

  const buildingVenues = useMemo(() => getBuildingVenues(building.id), [building.id]);
  const floorVenues = useMemo(
    () => buildingVenues.filter((v) => v.floor === activeFloor),
    [buildingVenues, activeFloor],
  );

  const floorPlan = useMemo(
    () => getFloorPlan(building.id, activeFloor, building.openStalls, building.totalStalls),
    [activeFloor, building.id, building.openStalls, building.totalStalls],
  );

  return (
    <Screen scroll={false} style={{ backgroundColor: palette.bg }}>
      {/* Building Hero */}
      <View style={{ height: HERO_HEIGHT, width: "100%", backgroundColor: palette.bgSoft }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <AppText style={{ fontSize: 60 }}>🏢</AppText>
        </View>
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 100,
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        />

        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            position: "absolute",
            top: spacing[4],
            left: spacing[4],
            width: 36,
            height: 36,
            borderRadius: componentRadii.search,
            backgroundColor: "rgba(255,255,255,0.9)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeft color={palette.text} size={20} />
        </Pressable>

        <View
          style={{ position: "absolute", bottom: spacing[4], left: spacing[4], right: spacing[4] }}
        >
          <AppText variant="h1" tone="inverse" style={{ fontSize: 20, fontWeight: "900" }}>
            {building.name}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
            <AppText variant="micro" tone="inverse" style={{ opacity: 0.8 }}>
              1 Kadayanallur St · {building.totalStalls} stalls
            </AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Star size={10} color={palette.amber} fill={palette.amber} />
              <AppText variant="micro" tone="inverse" style={{ fontWeight: "700" }}>
                4.6
              </AppText>
            </View>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={{ padding: spacing[4], paddingBottom: spacing[2] }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: palette.bgSoft,
            borderRadius: radii.pill,
            height: 44,
            paddingHorizontal: spacing[3],
            gap: spacing[2],
            borderWidth: 1,
            borderColor: palette.border,
          }}
        >
          <Search size={16} color={palette.textMuted} />
          <AppText variant="bodySmall" tone="muted">
            Find a stall or dish here…
          </AppText>
        </View>
      </View>

      {/* Floor Selector (Tab Strip) */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          paddingHorizontal: spacing[4],
        }}
      >
        {building.floors.map((floor) => {
          const isActive = activeFloor === floor;
          return (
            <Pressable
              key={floor}
              onPress={() => setActiveFloor(floor)}
              style={{
                paddingVertical: spacing[3],
                paddingHorizontal: spacing[4],
                borderBottomWidth: 2,
                borderBottomColor: isActive ? palette.orange : "transparent",
              }}
            >
              <AppText
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: isActive ? palette.orange : palette.textMuted,
                }}
              >
                {floor}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Popular on Floor */}
        <View style={{ marginTop: spacing[4] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingHorizontal: spacing[4],
              marginBottom: spacing[2],
            }}
          >
            <AppText variant="h3" style={{ fontWeight: "800" }}>
              Popular on {activeFloor}
            </AppText>
            <AppText variant="bodySmallBold" tone="accent">
              All dishes
            </AppText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[3] }}
          >
            {floorVenues.slice(0, 3).map((v) => {
              const dish = repository.getDishById(v.topDishId);
              return (
                <Card key={v.id} style={{ width: 130, padding: spacing[2] }}>
                  <View
                    style={{
                      height: 70,
                      backgroundColor: palette.bgSoft,
                      borderRadius: radii.sm,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AppText style={{ fontSize: 24 }}>🍜</AppText>
                  </View>
                  <AppText
                    variant="micro"
                    style={{ fontWeight: "700", marginTop: 6 }}
                    numberOfLines={1}
                  >
                    {dish?.name}
                  </AppText>
                  <AppText variant="micro" tone="muted">
                    {v.unitNumber}
                  </AppText>
                  <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                    S${dish?.price.toFixed(2)}
                  </AppText>
                </Card>
              );
            })}
          </ScrollView>
        </View>

        {/* Floor Map */}
        <View
          style={{
            margin: spacing[4],
            padding: spacing[4],
            backgroundColor: palette.bgSoft,
            borderRadius: componentRadii.card,
            borderWidth: 1,
            borderColor: palette.border,
          }}
        >
          <AppText
            variant="micro"
            tone="muted"
            style={{ textTransform: "uppercase", marginBottom: spacing[2] }}
          >
            {activeFloor} Floor Plan — {floorVenues.length} stalls
          </AppText>
          <View
            style={{
              height: 100,
              backgroundColor: "white",
              borderRadius: radii.md,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppText variant="micro" tone="muted">
              SVG Floor Map Placeholder
            </AppText>
          </View>
          <View style={{ flexDirection: "row", gap: spacing[3], marginTop: spacing[2] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: palette.orangeLight,
                  borderWidth: 1,
                  borderColor: palette.orange,
                  borderRadius: 2,
                }}
              />
              <AppText variant="micro" tone="muted">
                Open
              </AppText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: palette.bgMuted,
                  borderWidth: 1,
                  borderColor: palette.border,
                  borderRadius: 2,
                }}
              />
              <AppText variant="micro" tone="muted">
                Closed
              </AppText>
            </View>
          </View>
        </View>

        {/* Stall List */}
        <View style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[6] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: spacing[2],
            }}
          >
            <AppText variant="h3" style={{ fontWeight: "800" }}>
              Stalls on {activeFloor}
            </AppText>
            <AppText variant="bodySmallBold" tone="accent">
              {floorVenues.length} total
            </AppText>
          </View>
          {floorVenues.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => navigation.navigate("StallDetailV2", { venueId: v.id })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: spacing[3],
                borderBottomWidth: 1,
                borderBottomColor: palette.border,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radii.md,
                  borderWidth: 2,
                  borderColor: palette.orange,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: palette.bgSoft,
                }}
              >
                <AppText style={{ fontSize: 24 }}>🍜</AppText>
              </View>
              <View style={{ flex: 1, marginLeft: spacing[3] }}>
                <AppText variant="bodyBold">{v.name}</AppText>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: palette.success,
                    }}
                  />
                  <AppText variant="micro" tone="secondary">
                    Open · {v.unitNumber}
                  </AppText>
                </View>
              </View>
              <View
                style={{
                  backgroundColor: palette.successSoft,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <AppText variant="micro" style={{ color: palette.success, fontWeight: "800" }}>
                  A
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
