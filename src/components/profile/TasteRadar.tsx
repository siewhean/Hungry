import { Platform, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";

import { AppText } from "@/components/ui";
import { TASTE_DIMENSIONS } from "@/constants/taste";
import { describeTasteVector, tasteLevelLabel } from "@/features/profile/tasteFingerprint";
import { useHungryTheme } from "@/theme";
import type { TasteVector } from "@/types/domain";

const CENTER = 130;
/** Radius of the outer ring; the labels sit just outside it. */
const RING = 70;
const LABEL_RADIUS = RING + 14;

/**
 * Your six tastes as a radar. Axes and chips follow TASTE_DIMENSIONS, each axis is labelled on
 * the chart, and the chips say Low / Medium / High instead of a percentage.
 */
export function TasteRadar({ vector }: { vector: TasteVector }) {
  const { palette, radii, spacing, typography } = useHungryTheme();
  const point = (index: number, radius: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / TASTE_DIMENSIONS.length;
    return { x: CENTER + Math.cos(angle) * radius, y: CENTER + Math.sin(angle) * radius };
  };
  const polygon = (radius: number) =>
    TASTE_DIMENSIONS.map((_, index) => {
      const { x, y } = point(index, radius);
      return `${x},${y}`;
    }).join(" ");
  const values = TASTE_DIMENSIONS.map(({ key }, index) =>
    point(index, (Math.max(0, Math.min(10, vector[key])) / 10) * RING),
  );

  return (
    <View style={{ alignItems: "center", width: "100%", gap: spacing[3] }}>
      {/* Up to 260pt, never wider than the card: a 320-360pt phone leaves less than that. */}
      <View testID="profile-taste-radar" style={{ aspectRatio: 1, maxWidth: 260, width: "100%" }}>
        <Svg
          accessible={Platform.OS === "web" ? undefined : true}
          accessibilityRole="image"
          accessibilityLabel={describeTasteVector(vector)}
          width="100%"
          height="100%"
          viewBox="0 0 260 260"
        >
          {[RING, RING * 0.67, RING * 0.34].map((radius) => (
            <Polygon
              key={radius}
              points={polygon(radius)}
              fill="none"
              stroke={palette.border}
              strokeWidth={1}
            />
          ))}
          {TASTE_DIMENSIONS.map(({ key }, index) => {
            const end = point(index, RING);
            return (
              <Line
                key={key}
                x1={CENTER}
                y1={CENTER}
                x2={end.x}
                y2={end.y}
                stroke={palette.border}
                strokeWidth={1}
              />
            );
          })}
          <Polygon
            points={values.map(({ x, y }) => `${x},${y}`).join(" ")}
            fill={palette.orangeLight}
            stroke={palette.orange}
            strokeWidth={2.5}
          />
          {values.map(({ x, y }, index) => (
            <Circle key={TASTE_DIMENSIONS[index].key} cx={x} cy={y} r={4} fill={palette.orange} />
          ))}
          {TASTE_DIMENSIONS.map(({ key, label }, index) => {
            const { x, y } = point(index, LABEL_RADIUS);
            // Anchor the text away from the chart so a long label does not run into it.
            const anchor = Math.abs(x - CENTER) < 4 ? "middle" : x > CENTER ? "start" : "end";
            return (
              <SvgText
                key={key}
                x={x}
                y={y + 4}
                fontFamily={typography.h3.fontFamily}
                fontSize={12}
                fill={palette.textSecondary}
                textAnchor={anchor}
              >
                {label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing[2],
          justifyContent: "center",
        }}
      >
        {TASTE_DIMENSIONS.map(({ key, label }) => (
          <View
            key={key}
            style={{
              alignItems: "center",
              backgroundColor: palette.bgSoft,
              borderRadius: radii.pill,
              flexDirection: "row",
              gap: spacing[1],
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[1],
            }}
          >
            <AppText variant="micro" style={{ color: palette.text }}>
              {label} · {tasteLevelLabel(vector[key])}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
