import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { MapSurface, type MapSurfaceMarker } from "@/components/map/MapSurface";
import { AppSymbol, AppText } from "@/components/ui";
import { fitSavedPins } from "@/features/saved/savedDishes";
import { useHungryTheme } from "@/theme";
import type { Coordinate } from "@/types/domain";

/** One pin: a stall, with every saved dish (or the saved stall itself) at it counted. */
export type SavedMapViewPin = {
  id: string;
  coordinate: Coordinate;
  title: string;
  count: number;
};

type Props = {
  pins: readonly SavedMapViewPin[];
  /** "dish" or "stall": names what the pins hold in labels and the not-on-map note. */
  noun: "dish" | "stall";
  /** The diner's position when location is allowed; the map centres on it. */
  origin?: Coordinate;
  /** The bottom card's body for the opened pin: its saved dishes as rows, or the stall row. */
  renderPinCard: (pinId: string) => ReactNode;
  /** Called when a pin opens. */
  onPinOpened?: (pin: SavedMapViewPin) => void;
  /** Items with no point: the note under the map opens the list. */
  notOnMapCount: number;
  onShowNotOnMap: () => void;
};

const MAP_HEIGHT = 420;

/**
 * Saved dishes on the map: one pin per stall (dishes at the same stall share it, with a count).
 * Tapping a pin opens a bottom card with those dishes as rows, each with Get directions. The map
 * centres on the diner when location is allowed and otherwise fits every pin. Uses the shared
 * MapSurface, so the web build gets the same drawn fallback as the Map tab.
 */
export function SavedMapView({
  pins,
  noun,
  origin,
  renderPinCard,
  onPinOpened,
  notOnMapCount,
  onShowNotOnMap,
}: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pins.find((pin) => pin.id === selectedId);
  const fit = useMemo(() => fitSavedPins(pins), [pins]);
  const plural = noun === "dish" ? "dishes" : "stalls";

  const markers = useMemo<MapSurfaceMarker[]>(
    () =>
      pins.map((pin) => ({
        id: pin.id,
        label: pin.title,
        accessibilityLabel: `${pin.title}, ${pin.count} saved ${pin.count === 1 ? noun : plural}`,
        coordinate: pin.coordinate,
        accent: palette.orange,
        clusterCount: pin.count > 1 ? pin.count : undefined,
      })),
    [noun, palette.orange, pins, plural],
  );

  return (
    <View style={{ gap: spacing[2] }}>
      <View
        testID="saved-map"
        style={{
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          height: MAP_HEIGHT,
          overflow: "hidden",
        }}
      >
        <MapSurface
          style={{ flex: 1 }}
          centerCoordinate={origin ?? fit.center}
          zoomLevel={origin ? 13.5 : fit.zoom}
          markers={markers}
          selectedMarkerId={selectedId ?? undefined}
          currentLocation={origin}
          onMarkerPress={(id) => {
            setSelectedId(id);
            const pin = pins.find((candidate) => candidate.id === id);
            if (pin) onPinOpened?.(pin);
          }}
          onMapPress={() => setSelectedId(null)}
        />
        {selected ? (
          <View
            testID="saved-map-card"
            accessibilityLabel={`${selected.title}, saved ${plural}`}
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
              borderWidth: 1,
              bottom: spacing[2],
              left: spacing[2],
              maxHeight: 250,
              padding: spacing[2],
              position: "absolute",
              right: spacing[2],
            }}
          >
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
              <AppText variant="bodyBold" numberOfLines={1} style={{ flex: 1 }}>
                {selected.title}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                onPress={() => setSelectedId(null)}
                style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
              >
                <AppSymbol name="clearSearch" color={palette.textMuted} size={20} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: spacing[2] }}>
              {renderPinCard(selected.id)}
            </ScrollView>
          </View>
        ) : null}
      </View>
      {notOnMapCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${notOnMapCount} saved ${notOnMapCount === 1 ? `${noun} is` : `${plural} are`} not on the map. Show the list.`}
          onPress={onShowNotOnMap}
          style={{ justifyContent: "center", minHeight: 44 }}
        >
          <AppText variant="bodySmall" tone="secondary">
            {notOnMapCount} not on the map.{" "}
            <AppText variant="bodySmallBold" style={{ color: palette.orange }}>
              Show list
            </AppText>
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
