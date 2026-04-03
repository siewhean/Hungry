import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";

import { TASTE_DIMENSIONS } from "@/constants/taste";
import type { TasteVector } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

interface TasteRadarChartProps {
  vector: TasteVector;
  size?: number;
  showLabels?: boolean;
}

function normalizeVector(vector: TasteVector) {
  return [vector.sweet, vector.spicy, vector.sour, vector.salty, vector.rich, vector.aromatic].map((value) =>
    Math.max(0.18, Math.min(1, value / 10)),
  );
}

export function TasteRadarChart({ vector, size = 220, showLabels = true }: TasteRadarChartProps) {
  const { palette } = useHungryTheme();
  const values = useMemo(() => normalizeVector(vector), [vector]);

  const center = size / 2;
  const radius = size * 0.33;

  const points = values
    .map((value, index) => {
      const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
      const x = center + Math.cos(angle) * radius * value;
      const y = center + Math.sin(angle) * radius * value;
      return `${x},${y}`;
    })
    .join(" ");

  const axisLines = values.map((_, index) => {
    const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    return { x, y, angle };
  });

  const summary = `Taste profile: sweet ${vector.sweet.toFixed(1)}, spicy ${vector.spicy.toFixed(1)}, sour ${vector.sour.toFixed(1)}, salty ${vector.salty.toFixed(1)}, rich ${vector.rich.toFixed(1)}, aromatic ${vector.aromatic.toFixed(1)}.`;

  return (
    <View accessibilityLabel={summary}>
      <Svg width={size} height={size} accessibilityRole="image">
        {[0.35, 0.6, 0.85, 1].map((step) => (
          <Circle key={step} cx={center} cy={center} r={radius * step} stroke={palette.border} strokeWidth={1} fill="none" />
        ))}
        {axisLines.map(({ x, y }, index) => (
          <Line key={index} x1={center} y1={center} x2={x} y2={y} stroke={palette.border} strokeWidth={1} />
        ))}
        <Polygon points={points} fill={`${palette.orange}33`} stroke={palette.orange} strokeWidth={2} />
        {axisLines.map(({ x, y, angle }, index) => {
          const labelDistance = radius + 18;
          const labelX = center + Math.cos(angle) * labelDistance;
          const labelY = center + Math.sin(angle) * labelDistance + 4;
          return (
            <SvgText
              key={TASTE_DIMENSIONS[index].key}
              x={labelX}
              y={labelY}
              fill={palette.textMuted}
              fontSize="11"
              textAnchor="middle"
            >
              {TASTE_DIMENSIONS[index].shortLabel}
            </SvgText>
          );
        })}
      </Svg>
      {showLabels ? <AppText variant="bodySmall" tone="secondary">{summary}</AppText> : null}
    </View>
  );
}

