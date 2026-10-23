import { Platform, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";

import { AppText } from "@/components/ui/AppText";
import { useHungryTheme } from "@/theme";

export type TasteRadarAxis = {
  key: string;
  label: string;
  /** The dish's standard level, 0-10. */
  standard: number;
  /** How strong it feels to this diner, 0-10; omitted when the diner has no palette. */
  perceived?: number;
};

type Props = {
  axes: TasteRadarAxis[];
  size?: number;
};

const clamp = (value: number) => Math.max(0, Math.min(10, value));

/**
 * A radar (spider) chart of a dish's taste: a grey outline for the standard level everyone
 * shares and an orange shape for how it tastes to this diner.
 */
export function TasteRadarChart({ axes, size = 260 }: Props) {
  const { palette, spacing } = useHungryTheme();
  const center = size / 2;
  // Room around the shape for the axis labels.
  const radius = size / 2 - 34;
  const showPerceived = axes.some((axis) => axis.perceived !== undefined);

  const point = (index: number, distance: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axes.length;
    return { x: center + Math.cos(angle) * distance, y: center + Math.sin(angle) * distance };
  };
  const ring = (fraction: number) =>
    axes
      .map((_, index) => {
        const { x, y } = point(index, radius * fraction);
        return `${x},${y}`;
      })
      .join(" ");
  const shape = (read: (axis: TasteRadarAxis) => number) =>
    axes
      .map((axis, index) => {
        const { x, y } = point(index, (clamp(read(axis)) / 10) * radius);
        return `${x},${y}`;
      })
      .join(" ");

  const description = axes
    .map(
      (axis) =>
        `${axis.label} ${axis.standard} out of 10` +
        (axis.perceived !== undefined ? `, ${axis.perceived} for you` : ""),
    )
    .join("; ");

  return (
    <View style={{ alignItems: "center", gap: spacing[2] }}>
      <Svg
        accessible={Platform.OS === "web" ? undefined : true}
        accessibilityRole="image"
        accessibilityLabel={`Taste chart: ${description}`}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {[1, 0.66, 0.33].map((fraction) => (
          <Polygon
            key={fraction}
            points={ring(fraction)}
            fill={fraction === 1 ? palette.surfaceRaised : "none"}
            stroke={palette.border}
            strokeWidth={1}
          />
        ))}
        {axes.map((axis, index) => {
          const end = point(index, radius);
          const label = point(index, radius + 18);
          return [
            <Line
              key={`${axis.key}-line`}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke={palette.border}
              strokeWidth={1}
            />,
            <SvgText
              key={`${axis.key}-label`}
              x={label.x}
              y={label.y + 4}
              fill={palette.textSecondary}
              fontSize={12}
              fontWeight="600"
              textAnchor="middle"
            >
              {axis.label}
            </SvgText>,
          ];
        })}
        <Polygon
          points={shape((axis) => axis.standard)}
          fill={showPerceived ? "none" : palette.orangeLight}
          stroke={showPerceived ? palette.textMuted : palette.orange}
          strokeDasharray={showPerceived ? "4 3" : undefined}
          strokeWidth={showPerceived ? 1.5 : 2.5}
        />
        {showPerceived ? (
          <Polygon
            points={shape((axis) => axis.perceived ?? axis.standard)}
            fill={palette.orange}
            fillOpacity={0.18}
            stroke={palette.orange}
            strokeWidth={2.5}
          />
        ) : null}
        {axes.map((axis, index) => {
          const value = showPerceived ? (axis.perceived ?? axis.standard) : axis.standard;
          const { x, y } = point(index, (clamp(value) / 10) * radius);
          return <Circle key={`${axis.key}-dot`} cx={x} cy={y} r={3.5} fill={palette.orange} />;
        })}
      </Svg>
      {showPerceived ? (
        <View style={{ flexDirection: "row", gap: spacing[4] }}>
          <LegendItem color={palette.orange} label="For you" />
          <LegendItem color={palette.textMuted} label="Standard" dashed />
        </View>
      ) : null}
    </View>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  const { spacing } = useHungryTheme();
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1.5] }}>
      <View
        style={{
          borderColor: color,
          borderRadius: 2,
          borderStyle: dashed ? "dashed" : "solid",
          borderWidth: 1.5,
          height: 10,
          width: 14,
          backgroundColor: dashed ? "transparent" : color,
          opacity: dashed ? 1 : 0.85,
        }}
      />
      <AppText variant="micro" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}
