/**
 * WheelSvg
 *
 * Renders an N-slice pie wheel using react-native-svg.
 * Wrapped in an Animated.View so the caller can spin it
 * by rotating the View — no internal animation state here.
 *
 * Alternates between palette.orange and palette.bgSoft slices.
 * Labels sit along the arc midpoint at typography.micro size.
 * A static monogram badge is overlaid at the centre.
 */

import { View } from "react-native";
import { G, Path, Svg, Text as SvgText } from "react-native-svg";

import { useHungryTheme } from "@/theme";
import type { WheelEntry } from "@/types/domain";

interface Props {
  entries: WheelEntry[];
  size?: number;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function truncateLabel(label: string, maxChars: number): string {
  return label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
}

export function WheelSvg({ entries, size = 300 }: Props) {
  const { palette } = useHungryTheme();

  const active = Array.from(
    new Map(
      entries.filter((entry) => !entry.isEliminated).map((entry) => [entry.id, entry] as const),
    ).values(),
  );
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4; // 4px inset keeps the border from clipping
  const logoSize = size * 0.2;

  if (active.length === 0) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.bgSoft,
          borderWidth: 3,
          borderColor: palette.border,
        }}
      />
    );
  }

  const segmentAngle = 360 / active.length;
  const labelRadius = r * 0.62; // midpoint between centre and rim for label
  const maxLabelChars = active.length <= 4 ? 10 : active.length <= 8 ? 7 : 5;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G>
          {active.map((entry, i) => {
            const startAngle = i * segmentAngle;
            const endAngle = startAngle + segmentAngle;
            const midAngle = startAngle + segmentAngle / 2;
            const fill = i % 2 === 0 ? palette.orange : palette.surface;
            const textFill = i % 2 === 0 ? palette.textOnDark : palette.text;

            const labelPt = polarToCartesian(cx, cy, labelRadius, midAngle);
            const labelAngle = midAngle - 90; // rotate text to sit along arc

            return (
              <G key={entry.id}>
                <Path
                  d={slicePath(cx, cy, r, startAngle, endAngle)}
                  fill={fill}
                  stroke={palette.border}
                  strokeWidth={1}
                />
                <SvgText
                  x={labelPt.x}
                  y={labelPt.y}
                  fill={textFill}
                  fontSize={11}
                  fontWeight="500"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  rotation={labelAngle}
                  origin={`${labelPt.x}, ${labelPt.y}`}
                >
                  {truncateLabel(entry.label, maxLabelChars)}
                </SvgText>
              </G>
            );
          })}
        </G>
      </Svg>

      {/* Centre logo — positioned absolutely over the SVG */}
      <View
        style={{
          position: "absolute",
          top: cy - logoSize / 2,
          left: cx - logoSize / 2,
          width: logoSize,
          height: logoSize,
          borderRadius: logoSize / 2,
          overflow: "hidden",
          backgroundColor: palette.surface,
          borderWidth: 2,
          borderColor: palette.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={logoSize} height={logoSize}>
          <SvgText
            x={logoSize / 2}
            y={logoSize / 2 + 5}
            fill={palette.orange}
            fontSize={logoSize * 0.46}
            fontWeight="700"
            textAnchor="middle"
          >
            H
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}
