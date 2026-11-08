/**
 * Flat illustrations for the Food Portfolio, Leaderboard and People pages, in the same
 * construction as BowlIllustrationV2 and FoodPlatterIllustrationV2: a 64 by 64 viewBox, two or
 * three palette colours, no text, no gradients. All are decorative: screen readers skip them
 * and the empty state's title carries the meaning.
 */
import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { useHungryTheme } from "@/theme";

interface IllustrationProps {
  size?: number;
  testID?: string;
}

function Frame({ size, testID, children }: { size: number; testID?: string; children: ReactNode }) {
  return (
    <View
      testID={testID}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 64 64">
        {children}
      </Svg>
    </View>
  );
}

/** A small bowl with steam, the brand's dish mark, centred on (cx, cy). */
function SmallBowl({ cx, cy, fill, rim }: { cx: number; cy: number; fill: string; rim: string }) {
  return (
    <>
      <Path
        d={`M${cx - 7},${cy} C${cx - 7},${cy + 7} ${cx - 4},${cy + 9} ${cx},${cy + 9} C${cx + 4},${cy + 9} ${cx + 7},${cy + 7} ${cx + 7},${cy} Z`}
        fill={fill}
      />
      <Line x1={cx - 7} y1={cy} x2={cx + 7} y2={cy} stroke={rim} strokeWidth="1.5" />
    </>
  );
}

/** Three podium steps, the winner's bowl steaming on top. Behind the Leaderboard podium. */
export function PodiumIllustration({ size = 120, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  return (
    <Frame size={size} testID={testID}>
      <Rect x="6" y="34" width="17" height="24" rx="3" fill={palette.amber} />
      <Rect x="23.5" y="26" width="17" height="32" rx="3" fill={palette.orange} />
      <Rect x="41" y="40" width="17" height="18" rx="3" fill={palette.amber} opacity="0.6" />
      <SmallBowl cx={32} cy={14} fill={palette.orange} rim={palette.orangeDark} />
      <Path
        d="M28,8 Q30,6 28,3 M32,9 Q34,7 32,4 M36,8 Q38,6 36,3"
        stroke={palette.orange}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <Line
        x1="4"
        y1="58"
        x2="60"
        y2="58"
        stroke={palette.border}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Frame>
  );
}

/** An empty podium: dotted places where the first diners will stand. */
export function EmptyBoardIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  const dash = {
    stroke: palette.textMuted,
    strokeWidth: 1.5,
    strokeDasharray: "3 3",
  } as const;
  return (
    <Frame size={size} testID={testID}>
      <Rect x="6" y="36" width="17" height="22" rx="3" fill={palette.bgSoft} {...dash} />
      <Rect
        x="23.5"
        y="28"
        width="17"
        height="30"
        rx="3"
        fill={palette.orangeLight}
        stroke={palette.orange}
        strokeWidth="1.5"
      />
      <Rect x="41" y="42" width="17" height="16" rx="3" fill={palette.bgSoft} {...dash} />
      <Circle cx="14.5" cy="28" r="5" fill="none" {...dash} />
      <Circle
        cx="32"
        cy="19"
        r="5"
        fill="none"
        stroke={palette.orange}
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
      <Circle cx="49.5" cy="34" r="5" fill="none" {...dash} />
      <Line
        x1="4"
        y1="58"
        x2="60"
        y2="58"
        stroke={palette.border}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Frame>
  );
}

/** A 3 by 3 grid of plates with one dish in it. Your Food Portfolio before the first post. */
export function PortfolioEmptyIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  const cells = [8, 25, 42];
  return (
    <Frame size={size} testID={testID}>
      {cells.flatMap((y) =>
        cells.map((x) =>
          x === 25 && y === 25 ? null : (
            <Rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="14"
              height="14"
              rx="3"
              fill={palette.bgSoft}
              stroke={palette.border}
              strokeWidth="1.5"
              strokeDasharray="3 2"
            />
          ),
        ),
      )}
      <Rect
        x="25"
        y="25"
        width="14"
        height="14"
        rx="3"
        fill={palette.orangeLight}
        stroke={palette.orange}
        strokeWidth="1.5"
      />
      <SmallBowl cx={32} cy={30} fill={palette.orange} rim={palette.orangeDark} />
    </Frame>
  );
}

/** Two bowls with a dotted line between them. Nobody follows you yet. */
export function FollowersEmptyIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  return (
    <Frame size={size} testID={testID}>
      <Circle cx="16" cy="36" r="12" fill={palette.orangeLight} />
      <Circle cx="48" cy="36" r="12" fill={palette.amberLight} />
      <SmallBowl cx={16} cy={34} fill={palette.orange} rim={palette.orangeDark} />
      <SmallBowl cx={48} cy={34} fill={palette.amber} rim={palette.orangeDark} />
      <Path
        d="M24,24 Q32,12 40,24"
        stroke={palette.textMuted}
        strokeWidth="1.5"
        strokeDasharray="2 3"
        strokeLinecap="round"
        fill="none"
      />
    </Frame>
  );
}

/** A magnifier over a row of bowls. Find people who eat like you. */
export function FollowingEmptyIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  return (
    <Frame size={size} testID={testID}>
      <SmallBowl cx={12} cy={46} fill={palette.amber} rim={palette.orangeDark} />
      <SmallBowl cx={32} cy={46} fill={palette.orange} rim={palette.orangeDark} />
      <SmallBowl cx={52} cy={46} fill={palette.amber} rim={palette.orangeDark} />
      <Circle
        cx="30"
        cy="24"
        r="11"
        fill={palette.surface}
        fillOpacity="0.6"
        stroke={palette.navy}
        strokeWidth="3"
      />
      <Line
        x1="38"
        y1="32"
        x2="46"
        y2="40"
        stroke={palette.navy}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </Frame>
  );
}

/** An empty plate with a clock face and a small diner. New dishes from people you follow. */
export function FeedEmptyIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  return (
    <Frame size={size} testID={testID}>
      <Circle
        cx="30"
        cy="34"
        r="22"
        fill={palette.bgSoft}
        stroke={palette.border}
        strokeWidth="2"
      />
      <Circle
        cx="30"
        cy="34"
        r="14"
        fill={palette.surface}
        stroke={palette.border}
        strokeWidth="1.5"
      />
      <Path
        d="M30,25 L30,34 L37,38"
        stroke={palette.navy}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="50" cy="14" r="8" fill={palette.orange} />
      <Circle cx="50" cy="12" r="3" fill={palette.surface} />
      <Path
        d="M45,19 Q50,15 55,19"
        stroke={palette.surface}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </Frame>
  );
}

/** A plate and a camera with a short burst. Your first dish post. */
export function FirstPostIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  return (
    <Frame size={size} testID={testID}>
      <Circle
        cx="26"
        cy="40"
        r="18"
        fill={palette.bgSoft}
        stroke={palette.border}
        strokeWidth="2"
      />
      <SmallBowl cx={26} cy={37} fill={palette.amber} rim={palette.orangeDark} />
      <Rect x="34" y="18" width="24" height="17" rx="4" fill={palette.orange} />
      <Rect x="39" y="14" width="8" height="5" rx="2" fill={palette.orange} />
      <Circle cx="46" cy="26.5" r="5" fill={palette.surface} />
      <Circle cx="46" cy="26.5" r="2.5" fill={palette.orangeDark} />
      <Path
        d="M14,10 L14,16 M8,13 L11,13 M17,13 L20,13"
        stroke={palette.amber}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Frame>
  );
}

/** Three diners around a table. People on Hungry. */
export function PeopleFoundIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  return (
    <Frame size={size} testID={testID}>
      <Circle cx="20" cy="24" r="9" fill={palette.amber} />
      <Circle cx="44" cy="24" r="9" fill={palette.teal} />
      <Circle
        cx="32"
        cy="20"
        r="10"
        fill={palette.orange}
        stroke={palette.surface}
        strokeWidth="2"
      />
      <Rect x="8" y="38" width="48" height="8" rx="4" fill={palette.navy} />
      <Line
        x1="16"
        y1="46"
        x2="16"
        y2="56"
        stroke={palette.navy}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Line
        x1="48"
        y1="46"
        x2="48"
        y2="56"
        stroke={palette.navy}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </Frame>
  );
}
