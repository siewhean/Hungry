import { useMemo } from "react";
import { FlatList, Pressable, View } from "react-native";
import { MapPin, Store } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Badge, Button, Card, EmptyState, Screen } from "@/components/ui";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { useDiscoverData } from "@/features/discovery/discovery";
import type { BuildingSummary } from "@/types/domain";

function BuildingPin({
  building,
  index,
  onPress,
}: {
  building: BuildingSummary;
  index: number;
  onPress: () => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  const pinColor =
    building.type === "hawker_centre"
      ? palette.orange
      : building.type === "food_court"
        ? palette.teal
        : palette.textMuted;
  const positions: Array<{ top: `${number}%`; left: `${number}%` }> = [
    { top: "18%", left: "18%" },
    { top: "42%", left: "56%" },
    { top: "64%", left: "30%" },
  ];
  const position = positions[index % positions.length];

  return (
    <Pressable onPress={onPress} style={[{ position: "absolute" }, position]}>
      <View style={{ alignItems: "center", gap: 6 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: pinColor,
            borderRadius: radii.pill,
            height: 42,
            justifyContent: "center",
            width: 42,
          }}
        >
          <MapPin color={palette.bg} size={18} />
        </View>
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: radii.pill,
            paddingHorizontal: spacing[2],
            paddingVertical: spacing[1],
          }}
        >
          <AppText variant="micro" style={{ color: palette.navy }}>
            {building.name}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

export function HomeMapScreen() {
  useAppBootstrap();
  const navigation = useNavigation<any>();
  const { palette, spacing } = useHungryTheme();
  const { buildings } = useDiscoverData();
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const profile = useProfileStore((state) => state.profile);
  const gpsBadgeState = useLocationStore((state) => state.gpsBadgeState);
  const showToast = useUIStore((state) => state.showToast);

  const pickedDish = useMemo(() => mockRepository.getDecideForMe(profile.tasteVector), [profile.tasteVector]);

  return (
    <Screen
      title="Maps"
      subtitle="Tap a building, pick a level, and open the stall menu."
      scroll={false}
      headerRight={
        <Badge
          label={gpsBadgeState === "live" ? "GPS live" : gpsBadgeState === "manual" ? "manual" : "location off"}
          tone={gpsBadgeState === "live" ? "success" : gpsBadgeState === "manual" ? "warning" : "error"}
        />
      }
    >
      <View style={{ flex: 1, gap: spacing[4] }}>
        <Card style={{ minHeight: 340, gap: spacing[3], backgroundColor: palette.mapBg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <AppText variant="h2">Building selector</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Select a building pin to browse levels, stalls, menus, and dishes inside.
              </AppText>
            </View>
            <Button
              label="Dish pick"
              fullWidth={false}
              onPress={() => {
                if (!pickedDish) {
                  showToast({ message: "No nearby dish matched this profile.", tone: "warning" });
                  return;
                }
                setDecideForMe(pickedDish);
                navigation.navigate("DecideForMeResult");
              }}
            />
          </View>

          <View
            style={{
              backgroundColor: palette.bg,
              borderColor: palette.border,
              borderRadius: 20,
              borderWidth: 1,
              flex: 1,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {buildings.map((building, index) => (
              <BuildingPin
                key={building.id}
                building={building}
                index={index}
                onPress={() => {
                  setSelectedBuilding(building);
                  setSelectedFloor(building.floors[0]);
                  navigation.navigate("BuildingDrillDown");
                }}
              />
            ))}

            <View style={{ bottom: 12, left: 12, position: "absolute", right: 12 }}>
              <Card style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Store color={palette.orange} size={16} />
                  <AppText variant="h3">Scroll by level after you choose a building</AppText>
                </View>
                <AppText variant="bodySmall" tone="secondary">
                  Inside each building you can search for a stall, choose the level, and open its menu.
                </AppText>
              </Card>
            </View>
          </View>
        </Card>

        <AppText variant="h2">Nearby buildings</AppText>
        <FlatList
          data={buildings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 96 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setSelectedBuilding(item);
                setSelectedFloor(item.floors[0]);
                navigation.navigate("BuildingDrillDown");
              }}
            >
              <Card>
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="h3">{item.name}</AppText>
                      <AppText variant="bodySmall" tone="secondary">
                        {item.venueCount} stalls · {item.floors.join(", ")}
                      </AppText>
                    </View>
                    <Badge label={item.isClosedToday ? "Closed today" : "Open now"} tone={item.isClosedToday ? "warning" : "success"} />
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState title="No buildings nearby" body="There are no buildings available in the current mock dataset." />}
        />
      </View>
    </Screen>
  );
}
