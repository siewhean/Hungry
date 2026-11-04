/**
 * PassportStampArt — the ink stamp for one Passport category and level, drawn in SVG so every
 * category gets its own emblem, colour and shape.
 *
 * Cuisine stamps are round, like a customs seal: the category name curves along the top,
 * SINGAPORE along the bottom, and the emblem sits in the middle. Neighbourhood stamps are the
 * rectangular entry stamp of a travel passport. The level shows as 1 to 4 stars, and the
 * completed (fourth) level is printed solid with the emblem knocked out in paper colour.
 * A locked stamp is a faint dashed outline of the same design.
 */

import { useId } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
  TextPath,
} from "react-native-svg";

import { useHungryTheme } from "@/theme";

type Palette = ReturnType<typeof useHungryTheme>["palette"];

export type StampEmblem =
  | "hawker"
  | "chinese"
  | "malay"
  | "indian"
  | "japanese"
  | "western"
  | "cbd"
  | "chinatown"
  | "bugis"
  | "tampines"
  | "tiong-bahru";

interface StampLook {
  emblem: StampEmblem;
  /** The word printed on the stamp, upper case and short enough to fit. */
  label: string;
  shape: "seal" | "entry";
  ink: (palette: Palette) => string;
}

/** One look per category. A category not listed falls back to the hawker seal. */
export const STAMP_LOOKS: Record<string, StampLook> = {
  "cuisine-hawker": { emblem: "hawker", label: "HAWKER", shape: "seal", ink: (p) => p.orange },
  "cuisine-chinese": { emblem: "chinese", label: "CHINESE", shape: "seal", ink: (p) => p.error },
  "cuisine-malay": { emblem: "malay", label: "MALAY", shape: "seal", ink: (p) => p.success },
  "cuisine-indian": { emblem: "indian", label: "INDIAN", shape: "seal", ink: (p) => p.warning },
  "cuisine-japanese": {
    emblem: "japanese",
    label: "JAPANESE",
    shape: "seal",
    ink: (p) => p.saved,
  },
  "cuisine-western": {
    emblem: "western",
    label: "WESTERN",
    shape: "seal",
    ink: (p) => p.passportInk,
  },
  "hood-cbd": { emblem: "cbd", label: "CBD", shape: "entry", ink: (p) => p.teal },
  "hood-chinatown": {
    emblem: "chinatown",
    label: "CHINATOWN",
    shape: "entry",
    ink: (p) => p.error,
  },
  "hood-bugis": { emblem: "bugis", label: "BUGIS", shape: "entry", ink: (p) => p.saved },
  "hood-tampines": {
    emblem: "tampines",
    label: "TAMPINES",
    shape: "entry",
    ink: (p) => p.success,
  },
  "hood-tiong-bahru": {
    emblem: "tiong-bahru",
    label: "TIONG BAHRU",
    shape: "entry",
    ink: (p) => p.orange,
  },
};

export function getStampLook(categoryId: string): StampLook {
  return STAMP_LOOKS[categoryId] ?? STAMP_LOOKS["cuisine-hawker"]!;
}

interface PassportStampArtProps {
  categoryId: string;
  /** The stamp's level, from 0 (first stamp) to 3 (completed). */
  level: number;
  earned: boolean;
  size: number;
  /** Hide the level stars, for a caller that animates its own. */
  hideStars?: boolean;
}

export function PassportStampArt({
  categoryId,
  level,
  earned,
  size,
  hideStars = false,
}: PassportStampArtProps) {
  const { palette } = useHungryTheme();
  const look = getStampLook(categoryId);
  const pathId = `stamp-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const ink = earned ? look.ink(palette) : palette.textMuted;
  const solid = earned && level >= 3;
  // Paper colour for the knocked-out emblem on a completed stamp.
  const paper = palette.passportPage;
  const emblemColor = solid ? paper : ink;
  const dash = earned ? undefined : "4 3";
  const stars = Math.max(1, Math.min(4, level + 1));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: size, opacity: earned ? 0.94 : 0.5, width: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        {look.shape === "seal" ? (
          <G>
            <Defs>
              <Path id={`${pathId}-top`} d="M 18 60 A 42 42 0 0 1 102 60" />
              <Path id={`${pathId}-bottom`} d="M 11 60 A 49 49 0 0 0 109 60" />
            </Defs>
            <Circle
              cx={60}
              cy={60}
              r={55}
              fill={solid ? ink : "none"}
              stroke={ink}
              strokeWidth={4}
              strokeDasharray={dash}
            />
            <Circle
              cx={60}
              cy={60}
              r={38}
              fill="none"
              stroke={solid ? paper : ink}
              strokeWidth={1.5}
              strokeDasharray={level >= 1 ? undefined : "2 3"}
            />
            {level >= 2 ? (
              <G>
                <Circle cx={13} cy={60} r={2.2} fill={emblemColor} />
                <Circle cx={107} cy={60} r={2.2} fill={emblemColor} />
              </G>
            ) : null}
            <SvgText
              fill={emblemColor}
              fontSize={look.label.length > 7 ? 10 : 11.5}
              fontWeight="800"
              letterSpacing={1.6}
              textAnchor="middle"
            >
              <TextPath href={`#${pathId}-top`} startOffset="50%">
                {look.label}
              </TextPath>
            </SvgText>
            <SvgText
              fill={emblemColor}
              fontSize={7.5}
              fontWeight="700"
              letterSpacing={2.4}
              textAnchor="middle"
            >
              <TextPath href={`#${pathId}-bottom`} startOffset="50%">
                SINGAPORE
              </TextPath>
            </SvgText>
            <G transform="translate(42 32) scale(0.9)">
              <Emblem emblem={look.emblem} color={emblemColor} />
            </G>
            {hideStars ? null : <Stars count={stars} y={80} color={emblemColor} />}
          </G>
        ) : (
          <G transform="rotate(-4 60 60)">
            <Rect
              x={6}
              y={20}
              width={108}
              height={80}
              rx={9}
              fill={solid ? ink : "none"}
              stroke={ink}
              strokeWidth={4}
              strokeDasharray={dash}
            />
            <Rect
              x={13}
              y={27}
              width={94}
              height={66}
              rx={5}
              fill="none"
              stroke={solid ? paper : ink}
              strokeWidth={1.5}
              strokeDasharray={level >= 1 ? undefined : "2 3"}
            />
            <SvgText
              x={60}
              y={41}
              fill={emblemColor}
              fontSize={look.label.length > 9 ? 9 : 10.5}
              fontWeight="800"
              letterSpacing={1.4}
              textAnchor="middle"
            >
              {look.label}
            </SvgText>
            <Line x1={20} y1={46} x2={100} y2={46} stroke={emblemColor} strokeWidth={1} />
            <G transform="translate(18 50) scale(0.82)">
              <Emblem emblem={look.emblem} color={emblemColor} />
            </G>
            <SvgText
              x={80}
              y={63}
              fill={emblemColor}
              fontSize={7}
              fontWeight="700"
              letterSpacing={1.8}
              textAnchor="middle"
            >
              ARRIVED
            </SvgText>
            {level >= 2 ? (
              <Line x1={62} y1={68} x2={98} y2={68} stroke={emblemColor} strokeWidth={1} />
            ) : null}
            {hideStars ? null : <Stars count={stars} y={80} x={80} color={emblemColor} />}
          </G>
        )}
      </Svg>
    </View>
  );
}

/** Up to four five-point stars in a row, centred on x. */
function Stars({
  count,
  y,
  x = 60,
  color,
}: {
  count: number;
  y: number;
  x?: number;
  color: string;
}) {
  const gap = 10;
  const start = x - ((count - 1) * gap) / 2;
  return (
    <G>
      {Array.from({ length: count }, (_, index) => (
        <Polygon key={index} points={starPoints(start + index * gap, y, 4)} fill={color} />
      ))}
    </G>
  );
}

function starPoints(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return points.join(" ");
}

/** Each emblem is drawn in a 40 by 40 box. */
function Emblem({ emblem, color }: { emblem: StampEmblem; color: string }) {
  const line = { stroke: color, strokeWidth: 2.4, strokeLinecap: "round" as const, fill: "none" };
  switch (emblem) {
    case "hawker":
      // A hawker centre pavilion: pitched roof with eaves, columns and a counter.
      return (
        <G>
          <Path d="M2 16 L20 4 L38 16 Z" fill={color} />
          <Rect x={6} y={17} width={28} height={3} fill={color} />
          <Line x1={9} y1={21} x2={9} y2={34} {...line} />
          <Line x1={20} y1={21} x2={20} y2={34} {...line} />
          <Line x1={31} y1={21} x2={31} y2={34} {...line} />
          <Rect x={3} y={34} width={34} height={3} rx={1} fill={color} />
        </G>
      );
    case "chinese":
      // A noodle bowl with chopsticks and steam.
      return (
        <G>
          <Line x1={22} y1={4} x2={36} y2={18} {...line} />
          <Line x1={27} y1={3} x2={39} y2={15} {...line} />
          <Path d="M3 20 H37 A17 15 0 0 1 3 20 Z" fill={color} />
          <Rect x={14} y={34} width={12} height={3} rx={1} fill={color} />
          <Path d="M11 15 C9 12 13 10 11 6" {...line} strokeWidth={1.8} />
          <Path d="M18 15 C16 12 20 10 18 6" {...line} strokeWidth={1.8} />
        </G>
      );
    case "malay":
      // A woven ketupat with its leaf tail.
      return (
        <G>
          <Polygon points="20,6 35,21 20,36 5,21" {...line} strokeLinejoin="round" />
          <Path d="M12.5 13.5 L27.5 28.5 M27.5 13.5 L12.5 28.5" {...line} strokeWidth={1.8} />
          <Path
            d="M16 10 L31 25 M24 10 L9 25 M9 17 L24 32 M31 17 L16 32"
            {...line}
            strokeWidth={1.2}
          />
          <Path d="M20 6 C22 2 26 1 29 2" {...line} />
          <Path d="M20 6 C18 2 14 1 11 2" {...line} />
        </G>
      );
    case "indian":
      // A lit diya (oil lamp).
      return (
        <G>
          <Path d="M20 4 C24 10 25 14 20 18 C15 14 16 10 20 4 Z" fill={color} />
          <Path d="M3 22 H37 C35 31 28 35 20 35 C12 35 5 31 3 22 Z" fill={color} />
          <Line x1={14} y1={37} x2={26} y2={37} {...line} />
        </G>
      );
    case "japanese":
      // A torii gate.
      return (
        <G>
          <Path d="M2 8 C10 10 30 10 38 8 L37 12 C30 13 10 13 3 12 Z" fill={color} />
          <Rect x={6} y={16} width={28} height={3} fill={color} />
          <Line x1={11} y1={12} x2={10} y2={37} {...line} strokeWidth={3} />
          <Line x1={29} y1={12} x2={30} y2={37} {...line} strokeWidth={3} />
          <Line x1={20} y1={12} x2={20} y2={16} {...line} />
        </G>
      );
    case "western":
      // A crossed fork and knife.
      return (
        <G>
          <Line x1={8} y1={6} x2={32} y2={36} {...line} strokeWidth={2.8} />
          <Path d="M28 4 C36 8 36 16 31 19 L25 13 Z" fill={color} />
          <Line x1={32} y1={6} x2={8} y2={36} {...line} strokeWidth={2.8} />
          <Path
            d="M4 6 L4 11 C4 13 6 14 8 14 M8 4 L8 14 M12 6 L12 11 C12 13 10 14 8 14"
            {...line}
            strokeWidth={1.8}
          />
        </G>
      );
    case "cbd":
      // The skyline: three towers under a long roof deck.
      return (
        <G>
          <Rect x={2} y={8} width={36} height={3} rx={1.5} fill={color} />
          <Rect x={6} y={12} width={6} height={24} fill={color} />
          <Rect x={17} y={12} width={6} height={24} fill={color} />
          <Rect x={28} y={12} width={6} height={24} fill={color} />
          <Line x1={1} y1={37} x2={39} y2={37} {...line} />
        </G>
      );
    case "chinatown":
      // Two hanging lanterns.
      return (
        <G>
          <Line x1={2} y1={3} x2={38} y2={3} {...line} />
          <Line x1={11} y1={3} x2={11} y2={9} {...line} strokeWidth={1.6} />
          <Line x1={29} y1={3} x2={29} y2={12} {...line} strokeWidth={1.6} />
          <Rect x={7} y={9} width={8} height={2.5} fill={color} />
          <Path d="M11 11 C2 11 2 27 11 27 C20 27 20 11 11 11 Z" fill={color} />
          <Rect x={7} y={27} width={8} height={2.5} fill={color} />
          <Line x1={11} y1={30} x2={11} y2={35} {...line} strokeWidth={1.6} />
          <Rect x={25} y={12} width={8} height={2.5} fill={color} />
          <Path d="M29 14 C21 14 21 28 29 28 C37 28 37 14 29 14 Z" fill={color} />
          <Rect x={25} y={28} width={8} height={2.5} fill={color} />
          <Line x1={29} y1={31} x2={29} y2={36} {...line} strokeWidth={1.6} />
        </G>
      );
    case "bugis":
      // A golden dome on its drum, as on the nearby Kampong Glam skyline.
      return (
        <G>
          <Line x1={20} y1={1} x2={20} y2={6} {...line} strokeWidth={1.8} />
          <Path d="M20 6 C30 9 33 18 32 22 H8 C7 18 10 9 20 6 Z" fill={color} />
          <Rect x={8} y={23} width={24} height={11} fill={color} />
          <Rect x={4} y={34} width={32} height={3} fill={color} />
          <Line x1={3} y1={14} x2={3} y2={34} {...line} />
          <Line x1={37} y1={14} x2={37} y2={34} {...line} />
        </G>
      );
    case "tampines":
      // The tampines tree the town is named after.
      return (
        <G>
          <Circle cx={20} cy={13} r={11} fill={color} />
          <Circle cx={10} cy={19} r={7} fill={color} />
          <Circle cx={30} cy={19} r={7} fill={color} />
          <Path d="M18 22 L17 36 H23 L22 22 Z" fill={color} />
          <Line x1={6} y1={37} x2={34} y2={37} {...line} />
        </G>
      );
    case "tiong-bahru":
      // A songbird cage, from the estate's bird-singing corner.
      return (
        <G>
          <Path d="M20 2 C20 4 20 4 20 6" {...line} />
          <Path d="M6 22 C6 12 12 6 20 6 C28 6 34 12 34 22" {...line} />
          <Line x1={13} y1={9} x2={13} y2={32} {...line} strokeWidth={1.6} />
          <Line x1={20} y1={6} x2={20} y2={32} {...line} strokeWidth={1.6} />
          <Line x1={27} y1={9} x2={27} y2={32} {...line} strokeWidth={1.6} />
          <Line x1={6} y1={22} x2={6} y2={32} {...line} />
          <Line x1={34} y1={22} x2={34} y2={32} {...line} />
          <Rect x={3} y={32} width={34} height={4} rx={1} fill={color} />
        </G>
      );
  }
}

/** One level star on its own, for the stamp moment that pops them in one by one. */
export function StampStar({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Polygon points={starPoints(5, 5.4, 4.8)} fill={color} />
    </Svg>
  );
}
