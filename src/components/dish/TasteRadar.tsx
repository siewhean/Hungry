import React, { useMemo } from "react";
import { View, Dimensions } from "react-native";
import {
  Canvas,
  Path,
  Skia,
  Text,
  useFont,
  Fill,
  LinearGradient,
  vec,
  Circle,
  Group,
} from "@shopify/react-native-skia";
import Animated, {
  useDerivedValue,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useHungryTheme } from "@/theme";
import { TASTE_DIMENSIONS } from "@/constants/taste";
import type { TasteVector } from "@/types/domain";

interface TasteRadarProps {
  tasteVector: TasteVector;
  size?: number;
}

export function TasteRadar({ tasteVector, size = 300 }: TasteRadarProps) {
  const { palette, spacing } = useHungryTheme();
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.35;

  const points = useMemo(() => {
    return TASTE_DIMENSIONS.map((dim, i) => {
      const angle = (i * 2 * Math.PI) / TASTE_DIMENSIONS.length - Math.PI / 2;
      const score = tasteVector[dim.key] || 0;
      const r = (score / 10) * radius;
      return {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
        labelX: centerX + (radius + 25) * Math.cos(angle),
        labelY: centerY + (radius + 25) * Math.sin(angle),
        label: dim.label,
      };
    });
  }, [tasteVector, radius, centerX, centerY]);

  const radarPath = useMemo(() => {
    const path = Skia.Path.Make();
    if (points.length === 0) return path;
    
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i].x, points[i].y);
    }
    path.close();
    return path;
  }, [points]);

  // Background Grid Paths
  const gridPaths = useMemo(() => {
    return [0.2, 0.4, 0.6, 0.8, 1].map((step) => {
      const path = Skia.Path.Make();
      TASTE_DIMENSIONS.forEach((_, i) => {
        const angle = (i * 2 * Math.PI) / TASTE_DIMENSIONS.length - Math.PI / 2;
        const r = step * radius;
        const px = centerX + r * Math.cos(angle);
        const py = centerY + r * Math.sin(angle);
        if (i === 0) path.moveTo(px, py);
        else path.lineTo(px, py);
      });
      path.close();
      return path;
    });
  }, [radius, centerX, centerY]);

  return (
    <View style={{ width: size, height: size, alignSelf: "center" }}>
      <Canvas style={{ flex: 1 }}>
        {/* Background Grids */}
        {gridPaths.map((path, i) => (
          <Path
            key={i}
            path={path}
            color={palette.border}
            style="stroke"
            strokeWidth={1}
            opacity={0.3}
          />
        ))}

        {/* Axis Lines */}
        {TASTE_DIMENSIONS.map((_, i) => {
          const angle = (i * 2 * Math.PI) / TASTE_DIMENSIONS.length - Math.PI / 2;
          return (
            <Path
              key={i}
              path={`M ${centerX} ${centerY} L ${centerX + radius * Math.cos(angle)} ${centerY + radius * Math.sin(angle)}`}
              color={palette.border}
              style="stroke"
              strokeWidth={1}
              opacity={0.2}
            />
          );
        })}

        {/* Taste Polygon */}
        <Path path={radarPath} color={palette.orange} opacity={0.4} />
        <Path path={radarPath} color={palette.orange} style="stroke" strokeWidth={3} />

        {/* Data Points */}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} color={palette.orange} />
        ))}
      </Canvas>
    </View>
  );
}
