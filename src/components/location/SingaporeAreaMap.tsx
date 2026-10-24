import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Minus, Plus } from "lucide-react-native";

import {
  FULL_MAP_VIEW,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_PLACE_DOTS_ZOOM,
  SINGAPORE_MAP_HEIGHT,
  SINGAPORE_MAP_WIDTH,
  SINGAPORE_PLANNING_AREAS,
  clampMapView,
  mapViewBox,
  pointInRing,
  projectCoordinate,
  ringsToPath,
  unprojectPoint,
  type MapView,
} from "@/features/location/singaporeAreaMap";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";
import type { Coordinate } from "@/types/domain";

/** A mall, food court or hawker centre drawn as a dot once the map is zoomed in. */
export type MapPlaceDot = { id: string; name: string; coordinate: Coordinate };

type Props = {
  width: number;
  /** Planning areas drawn in orange (see planningAreasFor). */
  highlighted?: readonly string[];
  /** A dropped pin for a chosen place. */
  pin?: Coordinate;
  /** Places to show as dots when zoomed in far enough. */
  places?: readonly MapPlaceDot[];
  /** A tap on an area: its planning-area name and the tapped coordinate. */
  onAreaPress?: (planningArea: string, coordinate: Coordinate) => void;
  onPlacePress?: (place: MapPlaceDot) => void;
  /** Runs whenever the diner zooms or pans. */
  onViewChange?: (view: MapView) => void;
};

const AREA_PATHS = SINGAPORE_PLANNING_AREAS.map((area) => ({
  name: area.name,
  d: ringsToPath(area.rings),
}));
const ZOOM_STEP = 2;
/** A tap this close to a dot (in screen points) picks the place, not the area under it. */
const DOT_TAP_RADIUS = 18;
/** A newly dropped pin brings the map at least this close, so its neighbours show as dots. */
const PIN_FOCUS_ZOOM = 3;

/**
 * Singapore split into its planning areas. Tap an area to pick it (it turns orange); pinch or
 * use + / - to zoom, and drag to move. Zoomed in, malls, food courts and hawker centres show
 * as dots that can be tapped; a chosen place gets a pin.
 */
export function SingaporeAreaMap({
  width,
  highlighted = [],
  pin,
  places = [],
  onAreaPress,
  onPlacePress,
  onViewChange,
}: Props) {
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const height = (width * SINGAPORE_MAP_HEIGHT) / SINGAPORE_MAP_WIDTH;
  const [view, setView] = useState<MapView>(FULL_MAP_VIEW);
  const gestureStart = useRef<MapView>(FULL_MAP_VIEW);
  const viewRef = useRef(view);
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => {
    viewRef.current = view;
    onViewChangeRef.current = onViewChange;
  });
  const lit = useMemo(() => new Set(highlighted), [highlighted]);
  // ViewBox units per screen point at this zoom.
  const unitsPerPoint = SINGAPORE_MAP_WIDTH / view.zoom / width;
  const showDots = view.zoom >= MAP_PLACE_DOTS_ZOOM;
  const pinPoint = pin ? projectCoordinate(pin) : undefined;
  const placePoints = useMemo(
    () => places.map((place) => ({ place, point: projectCoordinate(place.coordinate) })),
    [places],
  );
  // A place picked from the search list: move the map to its pin.
  const pinLatitude = pin?.latitude;
  const pinLongitude = pin?.longitude;
  useEffect(() => {
    if (pinLatitude === undefined || pinLongitude === undefined) return;
    const point = projectCoordinate({ latitude: pinLatitude, longitude: pinLongitude });
    const next = clampMapView({
      centerX: point.x,
      centerY: point.y,
      zoom: Math.max(viewRef.current.zoom, PIN_FOCUS_ZOOM),
    });
    setView(next);
    onViewChangeRef.current?.(next);
  }, [pinLatitude, pinLongitude]);

  const label = highlighted.length
    ? `Map of Singapore with ${highlighted.join(", ")} highlighted`
    : "Map of Singapore by area";

  const changeView = (next: MapView) => {
    const clamped = clampMapView(next);
    setView(clamped);
    onViewChange?.(clamped);
  };
  const zoomBy = (factor: number) => {
    selectHaptic();
    changeView({ ...view, zoom: view.zoom * factor });
  };

  // Screen point -> viewBox point for the current view.
  const toMapPoint = (x: number, y: number) => ({
    x: view.centerX + (x - width / 2) * unitsPerPoint,
    y: view.centerY + (y - height / 2) * unitsPerPoint,
  });

  const handleTap = (x: number, y: number) => {
    const point = toMapPoint(x, y);
    if (showDots && onPlacePress) {
      const tapRadius = DOT_TAP_RADIUS * unitsPerPoint;
      const nearest = placePoints
        .map((entry) => ({
          ...entry,
          distance: Math.hypot(entry.point.x - point.x, entry.point.y - point.y),
        }))
        .filter((entry) => entry.distance <= tapRadius)
        .sort((a, b) => a.distance - b.distance)[0];
      if (nearest) {
        onPlacePress(nearest.place);
        return;
      }
    }
    if (!onAreaPress) return;
    const area = SINGAPORE_PLANNING_AREAS.find((entry) =>
      entry.rings.some((ring) => pointInRing(point.x, point.y, ring)),
    );
    if (area) onAreaPress(area.name, unprojectPoint(point.x, point.y));
  };

  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDistance(10)
    .onEnd((event, success) => {
      if (success) handleTap(event.x, event.y);
    });
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      gestureStart.current = view;
    })
    .onUpdate((event) => {
      changeView({ ...gestureStart.current, zoom: gestureStart.current.zoom * event.scale });
    });
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(8)
    .onStart(() => {
      gestureStart.current = view;
    })
    .onUpdate((event) => {
      const start = gestureStart.current;
      const startUnits = SINGAPORE_MAP_WIDTH / start.zoom / width;
      changeView({
        ...start,
        centerX: start.centerX - event.translationX * startUnits,
        centerY: start.centerY - event.translationY * startUnits,
      });
    });
  const gesture = Gesture.Race(Gesture.Simultaneous(pinch, pan), tap);

  const zoomButton = (kind: "in" | "out") => {
    const disabled = kind === "in" ? view.zoom >= MAP_MAX_ZOOM : view.zoom <= MAP_MIN_ZOOM;
    const Icon = kind === "in" ? Plus : Minus;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={kind === "in" ? "Zoom in" : "Zoom out"}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => zoomBy(kind === "in" ? ZOOM_STEP : 1 / ZOOM_STEP)}
        hitSlop={4}
        style={({ pressed }) => ({
          alignItems: "center",
          height: 36,
          justifyContent: "center",
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          width: 36,
        })}
      >
        <Icon color={palette.text} size={18} />
      </Pressable>
    );
  };

  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        height,
        overflow: "hidden",
        width,
      }}
    >
      <GestureDetector gesture={gesture}>
        <View accessible accessibilityRole="image" accessibilityLabel={label}>
          <Svg width={width} height={height} viewBox={mapViewBox(view)}>
            <G>
              {AREA_PATHS.map((area) => (
                <Path
                  key={area.name}
                  d={area.d}
                  fill={lit.has(area.name) ? palette.orange : palette.bgSoft}
                  fillOpacity={lit.has(area.name) ? 0.85 : 1}
                  stroke={lit.has(area.name) ? palette.orange : palette.textMuted}
                  strokeOpacity={lit.has(area.name) ? 1 : 0.45}
                  // Lines stay the same width on screen at every zoom.
                  strokeWidth={(lit.has(area.name) ? 2 : 1) * unitsPerPoint}
                  strokeLinejoin="round"
                />
              ))}
            </G>
            {showDots
              ? placePoints.map(({ place, point }) => (
                  <Circle
                    key={place.id}
                    cx={point.x}
                    cy={point.y}
                    r={5 * unitsPerPoint}
                    fill={palette.text}
                    stroke={palette.surface}
                    strokeWidth={1.5 * unitsPerPoint}
                  />
                ))
              : null}
            {pinPoint ? (
              <G transform={`translate(${pinPoint.x} ${pinPoint.y}) scale(${unitsPerPoint * 0.6})`}>
                <Circle cx={0} cy={0} r={26} fill={palette.orange} opacity={0.2} />
                <Path
                  d="M0 0c-6-16-20-24-20-38a20 20 0 1 1 40 0c0 14-14 22-20 38z"
                  fill={palette.orange}
                  stroke={palette.surface}
                  strokeWidth={3}
                />
                <Circle cx={0} cy={-38} r={7} fill={palette.surface} />
              </G>
            ) : null}
          </Svg>
        </View>
      </GestureDetector>
      <View
        style={[
          shadows.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radii.md,
            borderWidth: 1,
            position: "absolute",
            right: spacing[2],
            top: spacing[2],
          },
        ]}
      >
        {zoomButton("in")}
        <View style={{ backgroundColor: palette.border, height: 1 }} />
        {zoomButton("out")}
      </View>
    </View>
  );
}
