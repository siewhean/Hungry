import React, { useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Canvas, Path, Skia, Group } from "@shopify/react-native-skia";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSharedValue, useDerivedValue } from "react-native-reanimated";

import { useHungryTheme } from "@/theme";
import { componentRadii } from "@/theme/tokens";
import { MOCK_MAP_VIEWBOX, MOCK_POLYGONS, MockStallPolygon } from "@/data/mocks/v2_map_data";
import { computeStallStatus } from "@/utils/stallStatus";
import { getDataRepository } from "@/lib/services/serviceProvider";

interface SkiaFloorplanViewerProps {
  buildingId: string;
  floor: string;
  onStallPress: (stallId: string) => void;
}

const BUILDING_ID_ALIASES: Record<string, string[]> = {
  "building-maxwell": ["hc-maxwell"],
  "hc-maxwell": ["building-maxwell"],
};
const ZOOM_MIN = 0.75;
const ZOOM_MAX = 3;

function resolveBuildingIds(buildingId: string): Set<string> {
  return new Set([buildingId, ...(BUILDING_ID_ALIASES[buildingId] ?? [])]);
}

export function SkiaFloorplanViewer({ buildingId, floor, onStallPress }: SkiaFloorplanViewerProps) {
  const { palette } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const CANVAS_SIZE = screenWidth - 32;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const repository = getDataRepository();

  const resolvedBuildingIds = useMemo(() => resolveBuildingIds(buildingId), [buildingId]);
  const polygons = useMemo(() => {
    return MOCK_POLYGONS.filter((p) => resolvedBuildingIds.has(p.buildingId) && p.floor === floor);
  }, [floor, resolvedBuildingIds]);

  const mapViewBox = useMemo(() => {
    const direct = MOCK_MAP_VIEWBOX[`${buildingId}:${floor}`];
    if (direct) {
      return direct;
    }
    for (const alias of BUILDING_ID_ALIASES[buildingId] ?? []) {
      const byAlias = MOCK_MAP_VIEWBOX[`${alias}:${floor}`];
      if (byAlias) {
        return byAlias;
      }
    }
    return { width: 400, height: 400 };
  }, [buildingId, floor]);

  const fitPadding = 16;
  const baseScale = useMemo(() => {
    const fitWidth = (CANVAS_SIZE - fitPadding * 2) / mapViewBox.width;
    const fitHeight = (CANVAS_SIZE - fitPadding * 2) / mapViewBox.height;
    return Math.max(0.1, Math.min(fitWidth, fitHeight));
  }, [CANVAS_SIZE, mapViewBox.height, mapViewBox.width]);
  const baseTranslateX = useMemo(
    () => (CANVAS_SIZE - mapViewBox.width * baseScale) / 2,
    [CANVAS_SIZE, baseScale, mapViewBox.width],
  );
  const baseTranslateY = useMemo(
    () => (CANVAS_SIZE - mapViewBox.height * baseScale) / 2,
    [CANVAS_SIZE, baseScale, mapViewBox.height],
  );

  const venues = useMemo(
    () => repository.listVenuesByBuilding(buildingId),
    [repository, buildingId],
  );

  const paths = useMemo(() => {
    return polygons.map((p) => {
      const skPath = Skia.Path.MakeFromSVGString(p.path);
      return {
        id: p.id,
        stallId: p.stallId,
        path: skPath,
        type: p.type,
      };
    });
  }, [polygons]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const nextScale = savedScale.value * e.scale;
      scale.value = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextScale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const tapGesture = Gesture.Tap().onEnd((e) => {
    const renderedScale = baseScale * scale.value;
    const renderedX = baseTranslateX + translateX.value;
    const renderedY = baseTranslateY + translateY.value;
    const localX = (e.x - renderedX) / renderedScale;
    const localY = (e.y - renderedY) / renderedScale;

    for (const p of paths) {
      if (p.path && p.path.contains(localX, localY)) {
        if (p.stallId !== "none") {
          onStallPress(p.stallId);
        }
        break;
      }
    }
  });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, tapGesture);

  const getStatusColor = (stallId: string, type: MockStallPolygon["type"]) => {
    if (type === "background") return palette.surfaceRaised;
    if (type === "corridor") return palette.bgSoft;
    if (type === "non-food") return palette.navy;
    if (type === "unmapped") return palette.surface;
    const stall = venues.find((s) => s.id === stallId);
    if (!stall) return palette.navy;

    const match = stall.operatingHours?.match(
      /(\d+):(\d+)\s*(AM|PM|am|pm)\s*.\s*(\d+):(\d+)\s*(AM|PM|am|pm)/i,
    );
    let parsedHours;
    if (match) {
      let openH = parseInt(match[1], 10);
      if (match[3].toLowerCase() === "pm" && openH !== 12) openH += 12;
      if (match[3].toLowerCase() === "am" && openH === 12) openH = 0;

      let closeH = parseInt(match[4], 10);
      if (match[6].toLowerCase() === "pm" && closeH !== 12) closeH += 12;
      if (match[6].toLowerCase() === "am" && closeH === 12) closeH = 0;

      parsedHours = {
        open: `${openH.toString().padStart(2, "0")}:${match[2]}`,
        close: `${closeH.toString().padStart(2, "0")}:${match[5]}`,
      };
    }

    const status = computeStallStatus(parsedHours);
    switch (status) {
      case "open":
        return "#10B981"; // Green
      case "closing_soon":
        return "#F59E0B"; // Orange
      case "closed":
        return "#EF4444"; // Red
      default:
        return stall.isOpen ? "#10B981" : "#EF4444";
    }
  };

  const transform = useDerivedValue(() => {
    return [
      { translateX: baseTranslateX + translateX.value },
      { translateY: baseTranslateY + translateY.value },
      { scale: baseScale * scale.value },
    ];
  }, [baseScale, baseTranslateX, baseTranslateY]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={composedGesture}>
        <View style={[styles.container, { width: CANVAS_SIZE, height: CANVAS_SIZE }]}>
          <Canvas style={styles.canvas}>
            <Group transform={transform}>
              {paths.map(
                (p) =>
                  p.path && (
                    <Path
                      key={p.id}
                      path={p.path}
                      color={getStatusColor(p.stallId, p.type)}
                      style="fill"
                    />
                  ),
              )}
              {paths.map(
                (p) =>
                  p.path && (
                    <Path
                      key={`${p.id}-stroke`}
                      path={p.path}
                      color={palette.border}
                      style="stroke"
                      strokeWidth={1 / (baseScale * scale.value)}
                    />
                  ),
              )}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F9FAFB",
    borderRadius: componentRadii.card,
    overflow: "hidden",
    alignSelf: "center",
  },
  canvas: {
    flex: 1,
  },
});
