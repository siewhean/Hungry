import { useEffect, useMemo, type PropsWithChildren } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import MapboxGL from "@rnmapbox/maps";

import { FEATURE_FLAGS } from "@/constants/featureFlags";
import type { Coordinate } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

let hasConfiguredMapboxToken = false;

export interface MapSurfaceMarker {
  id: string;
  label: string;
  coordinate: Coordinate;
  accent?: string;
}

interface MapSurfaceProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  centerCoordinate: Coordinate;
  zoomLevel?: number;
  markers?: MapSurfaceMarker[];
  selectedMarkerId?: string;
  currentLocation?: Coordinate;
  onMarkerPress?: (markerId: string) => void;
  cameraPadding?: {
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
  };
}

function toMapboxPosition(coordinate: Coordinate): [number, number] {
  return [coordinate.longitude, coordinate.latitude];
}

function projectCoordinate(
  coordinate: Coordinate,
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  },
) {
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.0025);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0025);
  const x = ((coordinate.longitude - bounds.minLng) / lngSpan) * 100;
  const y = (1 - (coordinate.latitude - bounds.minLat) / latSpan) * 100;

  return {
    left: `${Math.min(92, Math.max(8, x))}%` as `${number}%`,
    top: `${Math.min(86, Math.max(12, y))}%` as `${number}%`,
  };
}

function MarkerVisual({
  label,
  accent,
  selected,
}: {
  label: string;
  accent: string;
  selected: boolean;
}) {
  const { palette, radii, spacing, shadows } = useHungryTheme();

  return (
    <View style={{ alignItems: "center", gap: spacing[1] }}>
      <View
        style={[
          styles.markerBody,
          {
            backgroundColor: accent,
            borderColor: selected ? palette.surface : `${accent}40`,
            borderRadius: radii.md,
            width: selected ? 40 : 34,
            height: selected ? 40 : 34,
          },
          selected ? shadows.floating : undefined,
        ]}
      >
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: radii.pill,
            width: 10,
            height: 10,
          }}
        />
      </View>
      {selected ? (
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.94)",
            borderColor: palette.border,
            borderRadius: radii.pill,
            borderWidth: 1,
            paddingHorizontal: spacing[2],
            paddingVertical: 4,
            minWidth: 84,
          }}
        >
          <AppText
            variant="micro"
            style={{ color: palette.text, fontFamily: "Nunito_700Bold", textAlign: "center" }}
            numberOfLines={1}
          >
            {label}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function UserPuck() {
  const { palette } = useHungryTheme();

  return (
    <View style={styles.userPuckOuter}>
      <View style={[styles.userPuckHalo, { backgroundColor: `${palette.navy}18` }]} />
      <View style={[styles.userPuckInner, { backgroundColor: palette.navy, borderColor: palette.surface }]} />
    </View>
  );
}

function FallbackMap({
  centerCoordinate,
  markers,
  selectedMarkerId,
  currentLocation,
  onMarkerPress,
}: Pick<
  MapSurfaceProps,
  "centerCoordinate" | "markers" | "selectedMarkerId" | "currentLocation" | "onMarkerPress"
>) {
  const { palette } = useHungryTheme();
  const coordinates = useMemo(
    () => [centerCoordinate, ...(markers ?? []).map((marker) => marker.coordinate), ...(currentLocation ? [currentLocation] : [])],
    [centerCoordinate, currentLocation, markers],
  );

  const bounds = useMemo(() => {
    const latitudes = coordinates.map((item) => item.latitude);
    const longitudes = coordinates.map((item) => item.longitude);

    return {
      minLat: Math.min(...latitudes) - 0.004,
      maxLat: Math.max(...latitudes) + 0.004,
      minLng: Math.min(...longitudes) - 0.004,
      maxLng: Math.max(...longitudes) + 0.004,
    };
  }, [coordinates]);

  return (
    <View style={[styles.map, { backgroundColor: palette.bgSoft }]}>
      <View style={[styles.road, { backgroundColor: "rgba(255,255,255,0.95)", width: 240, top: 90, left: -20, transform: [{ rotate: "13deg" }] }]} />
      <View style={[styles.road, { backgroundColor: "rgba(255,255,255,0.94)", width: 210, top: 56, right: -32, transform: [{ rotate: "-18deg" }] }]} />
      <View style={[styles.road, { backgroundColor: "rgba(255,255,255,0.92)", width: 300, bottom: 92, left: 24, transform: [{ rotate: "7deg" }] }]} />
      <View style={[styles.verticalRoad, { backgroundColor: "rgba(255,255,255,0.94)", left: "52%" }]} />

      {markers?.map((marker) => {
        const position = projectCoordinate(marker.coordinate, bounds);
        return (
          <Pressable
            key={marker.id}
            onPress={() => onMarkerPress?.(marker.id)}
            style={[styles.absoluteMarker, position]}
          >
            <MarkerVisual
              label={marker.label}
              accent={marker.accent ?? palette.orange}
              selected={marker.id === selectedMarkerId}
            />
          </Pressable>
        );
      })}

      {currentLocation ? (
        <View style={[styles.absoluteMarker, projectCoordinate(currentLocation, bounds)]}>
          <UserPuck />
        </View>
      ) : null}
    </View>
  );
}

export function MapSurface({
  style,
  centerCoordinate,
  zoomLevel = 15.3,
  markers,
  selectedMarkerId,
  currentLocation,
  onMarkerPress,
  cameraPadding,
}: MapSurfaceProps) {
  const { palette } = useHungryTheme();
  const shouldUseFallback = FEATURE_FLAGS.mockMapboxEnabled || !MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    if (!MAPBOX_ACCESS_TOKEN || hasConfiguredMapboxToken) {
      return;
    }

    MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);
    hasConfiguredMapboxToken = true;
  }, []);

  if (shouldUseFallback) {
    return (
      <View style={[styles.wrapper, { backgroundColor: palette.mapBg }, style]} accessibilityLabel="Map surface">
        <FallbackMap
          centerCoordinate={centerCoordinate}
          markers={markers}
          selectedMarkerId={selectedMarkerId}
          currentLocation={currentLocation}
          onMarkerPress={onMarkerPress}
        />
        {!MAPBOX_ACCESS_TOKEN ? (
          <View style={[styles.tokenNotice, { backgroundColor: "rgba(255,255,255,0.92)", borderColor: palette.border }]}>
            <AppText variant="micro" style={{ color: palette.textMuted }}>
              Set `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` to enable the live map.
            </AppText>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: palette.mapBg }, style]} accessibilityLabel="Map surface">
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Street}
        attributionEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scaleBarEnabled={false}
      >
        <MapboxGL.Camera
          animationDuration={500}
          animationMode="easeTo"
          centerCoordinate={toMapboxPosition(centerCoordinate)}
          padding={{
            paddingTop: cameraPadding?.paddingTop ?? 0,
            paddingBottom: cameraPadding?.paddingBottom ?? 0,
            paddingLeft: cameraPadding?.paddingLeft ?? 0,
            paddingRight: cameraPadding?.paddingRight ?? 0,
          }}
          zoomLevel={zoomLevel}
        />

        {markers?.map((marker) => (
          <MapboxGL.MarkerView
            key={marker.id}
            coordinate={toMapboxPosition(marker.coordinate)}
            allowOverlap
            anchor={{ x: 0.5, y: 1 }}
          >
            <Pressable onPress={() => onMarkerPress?.(marker.id)} style={styles.markerPressable}>
              <MarkerVisual
                label={marker.label}
                accent={marker.accent ?? palette.orange}
                selected={marker.id === selectedMarkerId}
              />
            </Pressable>
          </MapboxGL.MarkerView>
        ))}

        {currentLocation ? (
          <MapboxGL.MarkerView
            coordinate={toMapboxPosition(currentLocation)}
            allowOverlap
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <UserPuck />
          </MapboxGL.MarkerView>
        ) : null}
      </MapboxGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  markerPressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  road: {
    position: "absolute",
    height: 18,
    borderRadius: 999,
  },
  verticalRoad: {
    position: "absolute",
    top: 56,
    bottom: 56,
    width: 12,
    borderRadius: 999,
  },
  absoluteMarker: {
    position: "absolute",
    marginLeft: -20,
    marginTop: -20,
  },
  markerBody: {
    alignItems: "center",
    borderWidth: 2,
    justifyContent: "center",
    transform: [{ rotate: "-45deg" }],
  },
  userPuckOuter: {
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
  },
  userPuckHalo: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 999,
  },
  userPuckInner: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
  },
  tokenNotice: {
    position: "absolute",
    right: 12,
    top: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
});
