import { Platform, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";

import { DashedBoxSymbol } from "@/components/dish/dishSymbols";
import { AppText } from "@/components/ui/AppText";
import { dinerTasteLabel } from "@/features/detail/dishTasteSummary";
import { useHungryTheme } from "@/theme";

export type TasteRadarAxis = {
  key: string;
  label: string;
  /**
   * The dish's typical level, 0-10: an estimate from its catalog taste tags. Never labelled
   * "from reviews": what diners rated is `diners`.
   */
  standard: number;
  /** What diners who rated the taste say, 0-10; set only for an axis with enough raters. */
  diners?: number;
  /** How strong this dish is likely to feel to the diner, 0-10; omitted when they have no palette. */
  yours?: number;
};

type Props = {
  axes: TasteRadarAxis[];
  size?: number;
  /** Diners behind the `diners` levels; shown as "From N diners" in the legend. */
  dinerCount?: number;
  /** False when the dish has no usable estimate and only diner levels are drawn. */
  showEstimate?: boolean;
};

const clamp = (value: number) => Math.max(0, Math.min(10, value));

/**
 * A radar (spider) chart of a dish's taste: its typical level (an estimate) dashed in grey,
 * what diners who rated it say as a solid shape over that, and, when the diner has a palette,
 * how it is likely to taste to them in orange on top.
 */
export function TasteRadarChart({ axes, size = 260, dinerCount, showEstimate = true }: Props) {
  const { palette, spacing, typography } = useHungryTheme();
  const center = size / 2;
  // Room around the shape for the axis labels.
  const radius = size / 2 - 34;
  const showYours = axes.some((axis) => axis.yours !== undefined);
  const showDiners = axes.some((axis) => axis.diners !== undefined);

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
        `${axis.label} ${axis.diners ?? axis.standard} out of 10` +
        (axis.yours !== undefined ? `, your taste ${axis.yours}` : ""),
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
              fontFamily={typography.bodySmallBold.fontFamily}
              fontSize={13}
              textAnchor="middle"
            >
              {axis.label}
            </SvgText>,
          ];
        })}
        {/* Dashed grey: the dish's typical taste (an estimate). Solid: what diners rated, over it.
            Orange: how it tastes to this diner, on top. */}
        {showEstimate ? (
          <Polygon
            points={shape((axis) => axis.standard)}
            fill={palette.textSecondary}
            fillOpacity={0.14}
            stroke={palette.textSecondary}
            strokeDasharray="6 4"
            strokeWidth={2}
          />
        ) : null}
        {showEstimate
          ? axes.map((axis, index) => {
              const { x, y } = point(index, (clamp(axis.standard) / 10) * radius);
              return (
                <Circle key={`${axis.key}-dot`} cx={x} cy={y} r={3} fill={palette.textSecondary} />
              );
            })
          : null}
        {showDiners ? (
          <Polygon
            points={shape((axis) => axis.diners ?? (showEstimate ? axis.standard : 0))}
            fill={palette.text}
            fillOpacity={0.1}
            stroke={palette.text}
            strokeWidth={2}
          />
        ) : null}
        {showDiners
          ? axes.map((axis, index) => {
              if (axis.diners === undefined) return null;
              const { x, y } = point(index, (clamp(axis.diners) / 10) * radius);
              return (
                <Circle key={`${axis.key}-diners`} cx={x} cy={y} r={3.5} fill={palette.text} />
              );
            })
          : null}
        {showYours ? (
          <Polygon
            points={shape((axis) => axis.yours ?? 0)}
            fill={palette.orange}
            fillOpacity={0.16}
            stroke={palette.orange}
            strokeWidth={2.5}
          />
        ) : null}
        {showYours
          ? axes.map((axis, index) => {
              const { x, y } = point(index, (clamp(axis.yours ?? 0) / 10) * radius);
              return (
                <Circle key={`${axis.key}-yours`} cx={x} cy={y} r={3.5} fill={palette.orange} />
              );
            })
          : null}
      </Svg>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing[4],
          justifyContent: "center",
        }}
      >
        {showEstimate ? (
          <LegendItem dashed color={palette.textSecondary} label="Typical taste (estimate)" />
        ) : null}
        {showDiners ? (
          <LegendItem color={palette.text} label={dinerTasteLabel(dinerCount ?? 0)} />
        ) : null}
        {showYours ? <LegendItem color={palette.orange} label="How it tastes to you" /> : null}
      </View>
    </View>
  );
}

/** A dashed swatch marks the dashed outline, so the two series differ by more than colour. */
function LegendItem({
  color,
  dashed = false,
  label,
}: {
  color: string;
  dashed?: boolean;
  label: string;
}) {
  const { spacing } = useHungryTheme();
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1.5] }}>
      {dashed ? (
        <DashedBoxSymbol color={color} size={14} />
      ) : (
        <View
          style={{
            backgroundColor: color,
            borderColor: color,
            borderRadius: 2,
            borderWidth: 1.5,
            height: 10,
            opacity: 0.85,
            width: 14,
          }}
        />
      )}
      <AppText variant="micro" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}
