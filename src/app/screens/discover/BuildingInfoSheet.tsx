import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import {
  Building2,
  ChevronRight,
  Clock,
  Layers,
  MapPin,
  Star,
  UtensilsCrossed,
} from "lucide-react-native";

import { AppText, Badge, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { singaporeBuildings } from "@/lib/geo/singaporeBuildings";

interface BuildingInfoSheetProps {
  buildingId: string | null;
  onDismiss: () => void;
  onDrillDown: (buildingId: string) => void;
}

type BadgeTone = "orange" | "info" | "success" | "amber" | "warning" | "neutral";

const REGION_COLOURS: Record<string, BadgeTone> = {
  central: "orange",
  north: "info",
  east: "success",
  west: "amber",
  north_east: "warning",
};

const COVER_IMAGES: Record<string, string> = {
  maxwell_fc: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
  lau_pa_sat: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
  chinatown_fc: "https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&q=80",
  newton_fc: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80",
  tekka_centre: "https://images.unsplash.com/photo-1540914124281-342587941389?w=800&q=80",
};

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&q=80";

function StatPill({
  icon,
  label,
  palette,
  radii,
  spacing,
}: {
  icon: React.ReactNode;
  label: string;
  palette: any;
  radii: any;
  spacing: any;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: palette.bgSoft,
        borderRadius: radii.md,
        flexDirection: "row",
        gap: spacing[1],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
      }}
    >
      {icon}
      <AppText variant="bodySmall">{label}</AppText>
    </View>
  );
}

export function BuildingInfoSheet({ buildingId, onDismiss, onDrillDown }: BuildingInfoSheetProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const modalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["52%", "82%"], []);

  const building = useMemo(
    () => (buildingId ? singaporeBuildings.find((b) => b.id === buildingId) : null),
    [buildingId],
  );

  useEffect(() => {
    if (buildingId && building) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [buildingId, building]);

  if (!building) return null;

  const coverUri = COVER_IMAGES[building.id] ?? DEFAULT_COVER;
  const regionTone: BadgeTone = REGION_COLOURS[building.region] ?? "neutral";
  // floors is string[] — each entry is a floor label like "L1", "L2"
  const floorLabels: string[] = Array.isArray(building.floors) ? building.floors as string[] : [];
  const floorCount = floorLabels.length || 1;
  const stallCount = building.totalStalls ?? 0;
  const mockRating = (3.8 + (building.id.charCodeAt(0) % 10) / 10).toFixed(1);

  return (
    <BottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={onDismiss}
      backgroundStyle={{ backgroundColor: palette.surface }}
      handleIndicatorStyle={{ backgroundColor: palette.border }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover photo */}
        <Image
          source={{ uri: coverUri }}
          style={{ width: "100%", height: 180 }}
          contentFit="cover"
        />

        {/* Info section */}
        <View style={{ padding: spacing[5], gap: spacing[4] }}>
          {/* Title row */}
          <View style={{ gap: spacing[2] }}>
            <View style={{ flexDirection: "row", gap: spacing[2], flexWrap: "wrap" }}>
              <Badge label={building.region.replace("_", " ").toUpperCase()} tone={regionTone} />
              {building.type === "hawker_centre" && <Badge label="Hawker" tone="neutral" />}
              {building.type === "food_court" && <Badge label="Aircon" tone="info" />}
            </View>
            <AppText variant="h1">{building.name}</AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
              <MapPin size={14} color={palette.textMuted} />
              <AppText tone="secondary" variant="bodySmall">
                {building.address}
              </AppText>
            </View>
          </View>

          {/* Stats pills */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            <StatPill
              palette={palette}
              radii={radii}
              spacing={spacing}
              icon={<Layers size={14} color={palette.orange} />}
              label={`${floorCount} floor${floorCount > 1 ? "s" : ""}`}
            />
            <StatPill
              palette={palette}
              radii={radii}
              spacing={spacing}
              icon={<UtensilsCrossed size={14} color={palette.orange} />}
              label={`${stallCount > 0 ? stallCount : "50+"} stalls`}
            />
            <StatPill
              palette={palette}
              radii={radii}
              spacing={spacing}
              icon={<Star size={14} color={palette.orange} />}
              label={`${mockRating} avg`}
            />
            {building.operatingHours ? (
              <StatPill
                palette={palette}
                radii={radii}
                spacing={spacing}
                icon={<Clock size={14} color={palette.orange} />}
                label={building.operatingHours}
              />
            ) : null}
          </View>

          {/* Description */}
          <AppText tone="secondary" style={{ lineHeight: 22 }}>
            {`One of Singapore's beloved food destinations — ${building.name} brings together a wide range of stalls across ${floorCount} floor${floorCount > 1 ? "s" : ""}.`}
          </AppText>

          {/* Floors list */}
          {floorCount > 1 && (
            <View style={{ gap: spacing[2] }}>
              <AppText variant="h3">Floors</AppText>
              {floorLabels.slice(0, 3).map((floor) => (
                <Pressable
                  key={floor}
                  onPress={() => onDrillDown(building.id)}
                  style={{
                    alignItems: "center",
                    backgroundColor: palette.bgSoft,
                    borderRadius: radii.md,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                    <Building2 size={16} color={palette.orange} />
                    <AppText>{floor}</AppText>
                  </View>
                  <ChevronRight size={16} color={palette.textMuted} />
                </Pressable>
              ))}
              {floorCount > 3 && (
                <AppText tone="muted" variant="bodySmall">
                  +{floorCount - 3} more floors
                </AppText>
              )}
            </View>
          )}

          {/* CTA */}
          <Button
            label="Explore floor plan"
            onPress={() => {
              onDismiss();
              onDrillDown(building.id);
            }}
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
