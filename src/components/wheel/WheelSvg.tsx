/**
 * WheelSvg
 *
 * Renders an N-slice pie wheel using react-native-svg.
 * Wrapped in an Animated.View so the caller can spin it
 * by rotating the View — no internal animation state here.
 *
 * Alternates between palette.orange and palette.surface slices (a third colour closes an odd count).
 * Labels sit along the arc midpoint at typography.micro size.
 * A static Hungry logo badge is overlaid at the centre.
 */

import { View } from "react-native";
import { G, Path, Svg, Text as SvgText } from "react-native-svg";

import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { HUNGRY_LOGO_ICON } from "@/constants/brandAssets";
import { selectActiveWheelEntries } from "@/store/useWheelStore";
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

/**
 * A slice's fill and the text colour that reads on it. The lobby and spin lists use the same
 * colours for their dots, so a name in the list can be matched to its slice.
 */
export function getWheelSliceColors(
  palette: {
    orange: string;
    orangeLight: string;
    surface: string;
    text: string;
    textOnOrange: string;
  },
  index: number,
  count: number,
): { fill: string; text: string; isOrange: boolean } {
  // With an odd count the last slice would be orange next to the first one: use a third colour
  // there so neighbouring slices always differ.
  const isOddLast = count % 2 === 1 && count > 1 && index === count - 1;
  const isOrange = index % 2 === 0 && !isOddLast;
  return {
    fill: isOddLast ? palette.orangeLight : isOrange ? palette.orange : palette.surface,
    // Near-black on orange (white on orange measured 3.69:1).
    text: isOrange ? palette.textOnOrange : palette.text,
    isOrange,
  };
}

/**
 * Text along a slice's radius reads from the rim towards the centre on the right half and is
 * turned half a circle on the left half, so no label is ever upside down.
 */
export function wheelLabelRotation(midAngle: number): number {
  const along = midAngle - 90;
  return midAngle > 180 ? along + 180 : along;
}

function truncateLabel(label: string, maxChars: number): string {
  return label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
}

export function WheelSvg({ entries, size = 300 }: Props) {
  const { palette, typography } = useHungryTheme();

  const active = selectActiveWheelEntries(entries);
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
  // Radial text has the slice's length to run along, so the cut-off is generous.
  const maxLabelChars = active.length <= 4 ? 16 : active.length <= 8 ? 13 : 11;

  return (
    <View
      accessible
      accessibilityLabel={`Hungry wheel with ${active.length} options: ${active
        .map((entry) => entry.label)
        .join(", ")}`}
      accessibilityRole="image"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <G>
          {active.map((entry, i) => {
            const startAngle = i * segmentAngle;
            const endAngle = startAngle + segmentAngle;
            const midAngle = startAngle + segmentAngle / 2;
            const { fill, text: textFill } = getWheelSliceColors(palette, i, active.length);

            const labelPt = polarToCartesian(cx, cy, labelRadius, midAngle);
            const labelAngle = wheelLabelRotation(midAngle);

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
                  fontFamily={typography.bodySmallBold.fontFamily}
                  fontSize={12}
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
          borderRadius: logoSize * 0.22,
          overflow: "hidden",
          backgroundColor: palette.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AccessibleImage
          source={HUNGRY_LOGO_ICON}
          contentFit="contain"
          decorative
          style={{ width: logoSize, height: logoSize }}
        />
      </View>
    </View>
  );
}
