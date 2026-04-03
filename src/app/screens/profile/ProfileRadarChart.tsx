import { Fragment } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";

import { useHungryTheme } from "@/theme";
import type { TasteVector } from "@/types/domain";

interface ProfileRadarChartProps {
  value: TasteVector;
}

const axes = [
  { key: "sweet", label: "Sweet" },
  { key: "spicy", label: "Spicy" },
  { key: "sour", label: "Sour" },
  { key: "salty", label: "Salty" },
  { key: "rich", label: "Rich" },
  { key: "aromatic", label: "Aromatic" },
] as const;

export function ProfileRadarChart({ value }: ProfileRadarChartProps) {
  const { palette } = useHungryTheme();
  const size = 220;
  const center = size / 2;
  const maxRadius = 74;

  const points = axes.map((axis, index) => {
    const angle = ((Math.PI * 2) / axes.length) * index - Math.PI / 2;
    const magnitude = value[axis.key] / 10;
    const radius = maxRadius * magnitude;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    return `${x},${y}`;
  });

  return (
    <View style={{ alignItems: "center" }}>
      <Svg height={size} width={size} accessibilityLabel="Taste radar chart">
        <Circle cx={center} cy={center} r={maxRadius} stroke={palette.border} strokeWidth={1} fill="transparent" />
        <Circle cx={center} cy={center} r={maxRadius * 0.66} stroke={palette.border} strokeWidth={1} fill="transparent" />
        <Circle cx={center} cy={center} r={maxRadius * 0.33} stroke={palette.border} strokeWidth={1} fill="transparent" />
        {axes.map((axis, index) => {
          const angle = ((Math.PI * 2) / axes.length) * index - Math.PI / 2;
          const x = center + Math.cos(angle) * maxRadius;
          const y = center + Math.sin(angle) * maxRadius;
          const labelX = center + Math.cos(angle) * (maxRadius + 18);
          const labelY = center + Math.sin(angle) * (maxRadius + 18);
          return (
            <Fragment key={axis.key}>
              <Line x1={center} y1={center} x2={x} y2={y} stroke={palette.border} strokeWidth={1} />
              <SvgText x={labelX} y={labelY} fill={palette.textSecondary} fontSize="10" textAnchor="middle">
                {axis.label}
              </SvgText>
            </Fragment>
          );
        })}
        <Polygon points={points.join(" ")} fill={palette.orangeLight} stroke={palette.orange} strokeWidth={2} />
      </Svg>
    </View>
  );
}
