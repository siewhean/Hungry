/**
 * AchievementBadgeArt — the medal for one achievement at its current level, drawn in SVG to sit
 * beside the Passport stamps without copying them: stamps are ink on paper, achievements are
 * struck metal.
 *
 * Each achievement has its own emblem on a scalloped medal. The metal shows the level: bronze,
 * then silver, then gold, and the last level of any achievement is gold with ribbon tails and
 * a laurel. Pips under the emblem count the levels. Not started is a faint outline.
 */

import { View } from "react-native";
import Svg, { Circle, G, Line, Path, Polygon, Rect } from "react-native-svg";

import type { AchievementIcon } from "@/features/achievements/achievements";
import { useHungryTheme } from "@/theme";

type Palette = ReturnType<typeof useHungryTheme>["palette"];

export type MedalMetal = "none" | "bronze" | "silver" | "gold";

/** The metal for a level: the top level is always gold, whatever the number of levels. */
export function medalMetal(level: number, totalLevels: number): MedalMetal {
  if (level <= 0) return "none";
  if (level >= totalLevels) return "gold";
  if (level === 1) return "bronze";
  if (level === 2) return "silver";
  return "gold";
}

function metalColors(metal: MedalMetal, palette: Palette) {
  if (metal === "gold") {
    return {
      face: palette.medalGold,
      rim: palette.medalGoldRim,
      engrave: palette.medalEngraveDark,
    };
  }
  if (metal === "silver") {
    return {
      face: palette.medalSilver,
      rim: palette.medalSilverRim,
      engrave: palette.medalEngraveDark,
    };
  }
  if (metal === "bronze") {
    return {
      face: palette.medalBronze,
      rim: palette.medalBronzeRim,
      engrave: palette.medalEngraveLight,
    };
  }
  return { face: palette.textMuted, rim: palette.textMuted, engrave: palette.textMuted };
}

/** A 12-point scalloped edge, like a struck medal, around (60, 54). */
function scallopPath(cx: number, cy: number, outer: number, inner: number, points = 12): string {
  const steps: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    steps.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${steps.join(" L ")} Z`;
}

const MEDAL_EDGE = scallopPath(60, 54, 46, 41);

interface AchievementBadgeArtProps {
  icon: AchievementIcon;
  level: number;
  totalLevels: number;
  size: number;
}

export function AchievementBadgeArt({ icon, level, totalLevels, size }: AchievementBadgeArtProps) {
  const { palette } = useHungryTheme();
  const metal = medalMetal(level, totalLevels);
  const started = metal !== "none";
  const top = started && level >= totalLevels;
  const { face, rim, engrave } = metalColors(metal, palette);
  const emblem = engrave;
  const pipGap = 9;
  const pipStart = 60 - ((totalLevels - 1) * pipGap) / 2;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: size, opacity: started ? 1 : 0.5, width: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        {top ? (
          // Ribbon tails behind the medal for the last level.
          <G>
            <Path d="M44 84 L34 116 L45 110 L52 118 L58 90 Z" fill={palette.orange} />
            <Path d="M76 84 L86 116 L75 110 L68 118 L62 90 Z" fill={palette.orange} />
          </G>
        ) : null}
        <Path
          d={MEDAL_EDGE}
          fill={started ? rim : "none"}
          stroke={rim}
          strokeWidth={started ? 0 : 2}
          strokeDasharray={started ? undefined : "4 3"}
        />
        <Circle
          cx={60}
          cy={54}
          r={36}
          fill={started ? face : "none"}
          stroke={started ? engrave : rim}
          strokeWidth={1.5}
          strokeOpacity={started ? 0.55 : 1}
        />
        {top ? <Laurel color={engrave} /> : null}
        <G transform="translate(42 30) scale(0.9)">
          <AchievementEmblem icon={icon} color={emblem} cut={started ? face : palette.surface} />
        </G>
        {Array.from({ length: totalLevels }, (_, index) => (
          <Circle
            key={index}
            cx={pipStart + index * pipGap}
            cy={77}
            r={2.6}
            fill={index < level ? emblem : "none"}
            stroke={emblem}
            strokeWidth={1.2}
          />
        ))}
      </Svg>
    </View>
  );
}

/** Two laurel sprigs inside the rim, for the last level. */
function Laurel({ color }: { color: string }) {
  const leaves = [0, 1, 2, 3];
  return (
    <G opacity={0.85}>
      {leaves.map((index) => {
        const y = 66 - index * 9;
        const x = 31 + index * 1.2;
        return (
          <G key={index}>
            <Path d={`M${x} ${y} c-4 -2 -5 -6 -3 -9 c3 1 5 5 3 9 Z`} fill={color} />
            <Path d={`M${120 - x} ${y} c4 -2 5 -6 3 -9 c-3 1 -5 5 -3 9 Z`} fill={color} />
          </G>
        );
      })}
    </G>
  );
}

/** Each emblem is drawn in a 40 by 40 box. */
function AchievementEmblem({
  icon,
  color,
  cut,
}: {
  icon: AchievementIcon;
  color: string;
  /** The medal face colour, for the parts of an emblem that are cut out of it. */
  cut: string;
}) {
  const line = { stroke: color, strokeWidth: 2.6, strokeLinecap: "round" as const, fill: "none" };
  switch (icon) {
    case "utensils":
      // Dish collector: a plate with a fork and spoon either side.
      return (
        <G>
          <Circle cx={20} cy={20} r={11} {...line} />
          <Circle cx={20} cy={20} r={6} fill={color} />
          <Line x1={3} y1={6} x2={3} y2={34} {...line} strokeWidth={2.2} />
          <Path d="M0 6 V13 C0 15 6 15 6 13 V6" {...line} strokeWidth={1.8} />
          <Path d="M37 6 C33 6 33 16 37 16 C41 16 41 6 37 6 Z" fill={color} />
          <Line x1={37} y1={16} x2={37} y2={34} {...line} strokeWidth={2.2} />
        </G>
      );
    case "map-pin":
      // Centre hopper: a map pin with a hawker roof inside, and a path behind it.
      return (
        <G>
          <Path d="M2 36 C10 30 14 38 22 33" {...line} strokeWidth={1.8} strokeDasharray="3 3" />
          <Path
            d="M24 2 C16 2 11 8 11 15 C11 24 24 34 24 34 C24 34 37 24 37 15 C37 8 32 2 24 2 Z"
            fill={color}
          />
          <Circle cx={24} cy={15} r={5.5} fill={cut} />
        </G>
      );
    case "store":
      // Stall explorer: a stall with a striped awning.
      return (
        <G>
          <Path d="M3 14 L7 4 H33 L37 14 Z" fill={color} />
          <Path
            d="M3 14 C3 18 9 18 9 14 C9 18 15 18 15 14 C15 18 21 18 21 14 C21 18 27 18 27 14 C27 18 33 18 33 14 C33 18 37 18 37 14"
            {...line}
            strokeWidth={2}
          />
          <Line x1={6} y1={19} x2={6} y2={35} {...line} />
          <Line x1={34} y1={19} x2={34} y2={35} {...line} />
          <Rect x={12} y={24} width={16} height={11} rx={1.5} fill={color} />
          <Line x1={2} y1={36} x2={38} y2={36} {...line} />
        </G>
      );
    case "flame":
      // Spice chaser: a chilli with its stalk.
      return (
        <G>
          <Path
            d="M28 10 C36 14 34 28 22 34 C14 38 6 36 4 33 C12 33 20 26 22 16 C23 12 25 10 28 10 Z"
            fill={color}
          />
          <Path d="M28 10 C28 6 31 3 35 3" {...line} />
          <Path d="M25 9 C27 7 31 7 32 10" {...line} strokeWidth={2} />
        </G>
      );
    case "candy":
      // Sweet tooth: an ice kachang mound in a bowl, with a cherry on top.
      return (
        <G>
          <Path d="M7 22 C7 10 33 10 33 22 Z" fill={color} />
          <Circle cx={20} cy={8} r={4} fill={color} />
          <Path d="M20 4 C21 1 24 0 26 1" {...line} strokeWidth={1.8} />
          <Path d="M3 23 H37 C35 31 28 34 20 34 C12 34 5 31 3 23 Z" fill={color} />
          <Line x1={14} y1={37} x2={26} y2={37} {...line} />
        </G>
      );
    case "coins":
      // Budget eater: a stack of coins with a dollar sign.
      return (
        <G>
          <Rect x={2} y={28} width={20} height={5} rx={2.5} fill={color} />
          <Rect x={2} y={22} width={20} height={5} rx={2.5} fill={color} />
          <Rect x={2} y={16} width={20} height={5} rx={2.5} fill={color} />
          <Circle cx={28} cy={20} r={11} {...line} />
          <Path
            d="M31 15 C29 13 24 14 25 17 C26 20 31 19 31 23 C31 26 26 27 24 25 M28 12 V28"
            {...line}
            strokeWidth={2}
          />
        </G>
      );
    case "pen":
      // Critic: a fountain pen nib over a line of writing.
      return (
        <G>
          <Polygon points="30,2 38,10 18,30 9,32 11,22" fill={color} />
          <Line x1={13} y1={28} x2={24} y2={17} stroke={cut} strokeWidth={1.6} />
          <Circle cx={25} cy={16} r={2.4} fill={cut} />
          <Path d="M2 37 C8 33 12 39 18 35 S28 37 38 35" {...line} strokeWidth={2} />
        </G>
      );
    case "bookmark":
      // Curator: a bookmark ribbon with a star.
      return (
        <G>
          <Path d="M9 2 H31 V37 L20 29 L9 37 Z" fill={color} />
          <Polygon
            points="20,9 22.4,14.2 28,14.6 23.7,18.2 25.1,23.6 20,20.7 14.9,23.6 16.3,18.2 12,14.6 17.6,14.2"
            fill={cut}
          />
        </G>
      );
  }
}
