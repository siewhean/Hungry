import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import MapboxGL from "@rnmapbox/maps";

import { FEATURE_FLAGS } from "@/constants/featureFlags";
import type { BuildingType, Coordinate } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";
import { BuildingPin } from "./BuildingPin";

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

let hasConfiguredMapboxToken = false;

export interface MapSurfaceMarker {
  id: string;
  label: string;
  coordinate: Coordinate;
  accent?: string;
  type?: BuildingType;
}

interface MapSurfaceProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  centerCoordinate: Coordinate;
  zoomLevel?: number;
  markers?: MapSurfaceMarker[];
  selectedMarkerId?: string;
  currentLocation?: Coordinate;
  onMarkerPress?: (markerId: string) => void;
  onMapPress?: (coordinate: Coordinate) => void;
  onZoomChange?: (zoom: number) => void;
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

function unprojectCoordinate(
  point: { x: number; y: number },
  frame: { width: number; height: number },
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  },
): Coordinate {
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.0025);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0025);
  const xRatio = Math.min(1, Math.max(0, point.x / Math.max(frame.width, 1)));
  const yRatio = Math.min(1, Math.max(0, point.y / Math.max(frame.height, 1)));

  return {
    longitude: bounds.minLng + xRatio * lngSpan,
    latitude: bounds.maxLat - yRatio * latSpan,
  } as Coordinate;
}

function MarkerVisual({
  label,
  accent,
  selected,
  type,
  zoomLevel = 15,
}: {
  label: string;
  accent: string;
  selected: boolean;
  type?: BuildingType;
  zoomLevel?: number;
}) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const showLabel = selected || zoomLevel >= 15.5;

  if (type) {
    return (
      <BuildingPin
        name={label}
        type={type}
        selected={selected}
      />
    );
  }

  return (
    <View style={{ alignItems: "center", gap: spacing[1] }}>
      <View
        style={[
          styles.markerBody,
          {
            backgroundColor: accent,
            borderColor: selected ? palette.surface : `${accent}40`,
            borderRadius: radii.md,
            width: selected ? 44 : 36,
            height: selected ? 44 : 36,
          },
          selected ? shadows.floating : undefined,
        ]}
      >
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: radii.pill,
            width: 12,
            height: 12,
          }}
        />
      </View>
      {showLabel ? (
        <View
          style={{
            backgroundColor: selected ? palette.surface : "rgba(255,255,255,0.85)",
            borderColor: selected ? palette.orange : palette.border,
            borderRadius: radii.pill,
            borderWidth: 1,
            paddingHorizontal: spacing[2],
            paddingVertical: 4,
            minWidth: 84,
            ...shadows.floating,
          }}
        >
          <AppText
            variant="micro"
            style={{ 
              color: palette.text, 
              fontFamily: selected ? "Nunito_800ExtraBold" : "Nunito_700Bold", 
              textAlign: "center" 
            }}
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
  const { palette, radii } = useHungryTheme();

  return (
    <View style={styles.userPuckOuter}>
      <View style={[styles.userPuckHalo, { backgroundColor: `${palette.navy}12`, borderRadius: radii.pill, height: 36, width: 36 }]} />
      <View style={[styles.userPuckInner, { backgroundColor: palette.navy, borderColor: palette.surface, borderRadius: radii.pill, height: 14, width: 14 }]} />
    </View>
  );
}

function FallbackMap({
  centerCoordinate,
  markers,
  selectedMarkerId,
  currentLocation,
  onMarkerPress,
  onMapPress,
  cameraPadding,
}: Pick<
  MapSurfaceProps,
  "centerCoordinate" | "markers" | "selectedMarkerId" | "currentLocation" | "onMarkerPress" | "onMapPress" | "cameraPadding"
>) {
  const { palette, radii } = useHungryTheme();
  const [frame, setFrame] = useState({ width: 1, height: 1 });

  // Apply padding to the map container to simulate camera offset
  const containerStyle = useMemo(() => ({
    paddingTop: cameraPadding?.paddingTop ?? 0,
    paddingBottom: cameraPadding?.paddingBottom ?? 0,
    paddingLeft: cameraPadding?.paddingLeft ?? 0,
    paddingRight: cameraPadding?.paddingRight ?? 0,
  }), [cameraPadding]);

  const coordinates = useMemo(
    () => [
      centerCoordinate,
      ...(Array.isArray(markers) ? markers.map((marker) => marker.coordinate) : []),
      ...(currentLocation ? [currentLocation] : []),
    ],
    [centerCoordinate, currentLocation, markers],
  );

  const bounds = useMemo(() => {
    const latitudes = coordinates.map((item) => item.latitude);
    const longitudes = coordinates.map((item) => item.longitude);

    if (latitudes.length === 0 || longitudes.length === 0) {
      return {
        minLat: centerCoordinate.latitude - 0.004,
        maxLat: centerCoordinate.latitude + 0.004,
        minLng: centerCoordinate.longitude - 0.004,
        maxLng: centerCoordinate.longitude + 0.004,
      };
    }

    return {
      minLat: Math.min(...latitudes) - 0.004,
      maxLat: Math.max(...latitudes) + 0.004,
      minLng: Math.min(...longitudes) - 0.004,
      maxLng: Math.max(...longitudes) + 0.004,
    };
  }, [coordinates, centerCoordinate]);

  return (
    <View
      style={[styles.map, { backgroundColor: palette.bgSoft }, containerStyle]}
      onLayout={(event: LayoutChangeEvent) => {
        setFrame({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        });
      }}
      onStartShouldSetResponder={() => Boolean(onMapPress)}
      onResponderRelease={(event: GestureResponderEvent) => {
        if (!onMapPress) {
          return;
        }
        const coordinate = unprojectCoordinate(
          { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY },
          frame,
          bounds,
        );
        onMapPress(coordinate);
      }}
    >
      <View
        style={[
          styles.road,
          {
            backgroundColor: palette.mapRoadPrimary,
            borderRadius: radii.pill,
            left: -20,
            top: 90,
            transform: [{ rotate: "13deg" }],
            width: 240,
          },
        ]}
      />
      <View
        style={[
          styles.road,
          {
            backgroundColor: palette.mapRoadSecondary,
            borderRadius: radii.pill,
            right: -32,
            top: 56,
            transform: [{ rotate: "-18deg" }],
            width: 210,
          },
        ]}
      />
      <View
        style={[
          styles.road,
          {
            backgroundColor: palette.mapRoadPrimary,
            borderRadius: radii.pill,
            bottom: 92,
            left: 24,
            transform: [{ rotate: "7deg" }],
            width: 300,
          },
        ]}
      />
      <View
        style={[
          styles.verticalRoad,
          {
            backgroundColor: palette.mapRoadSecondary,
            borderRadius: radii.pill,
            left: "52%",
          },
        ]}
      />

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
              type={marker.type}
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
  onMapPress,
  onZoomChange,
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
          onMapPress={onMapPress}
          cameraPadding={cameraPadding}
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
        onPress={(event) => {
          const [longitude, latitude] = event.geometry.coordinates as [number, number];
          onMapPress?.({ latitude, longitude });
        }}
        onRegionDidChange={(feature) => {
          if (onZoomChange) {
            onZoomChange(feature.properties.zoomLevel);
          }
        }}
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
            <Pressable onPress={() => onMarkerPress?.(marker.id)} style={[styles.markerPressable, { minWidth: 44, minHeight: 44 }]}>
              <MarkerVisual
                label={marker.label}
                accent={marker.accent ?? palette.orange}
                selected={marker.id === selectedMarkerId}
                type={marker.type}
                zoomLevel={zoomLevel}
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
  },
  verticalRoad: {
    position: "absolute",
    top: 56,
    bottom: 56,
    width: 12,
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
  },
  userPuckInner: {
    width: 12,
    height: 12,
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
