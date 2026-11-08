/**
 * Flat illustrations for places, stamps, reviews and privacy, drawn like SocialIllustrations: a
 * 64 by 64 viewBox, two or three palette colours, no text, no gradients. All are decorative:
 * screen readers skip them and the empty state's title carries the meaning.
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

/** A small bowl centred on (cx, cy), the brand's dish mark. */
function Bowl({ cx, cy, fill, rim }: { cx: number; cy: number; fill: string; rim: string }) {
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

/** A map pin holding a bowl, on a dotted trail. Nothing saved or visited yet. */
export function MapPinBowlIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  return (
    <Frame size={size} testID={testID}>
      <Path
        d="M6,56 Q20,46 32,54 Q44,62 58,50"
        stroke={palette.textMuted}
        strokeWidth="1.5"
        strokeDasharray="2 3"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M32,6 C21,6 14,14 14,23 C14,35 32,50 32,50 C32,50 50,35 50,23 C50,14 43,6 32,6 Z"
        fill={palette.orange}
      />
      <Circle cx="32" cy="23" r="11" fill={palette.surface} />
      <Bowl cx={32} cy={21} fill={palette.amber} rim={palette.orangeDark} />
    </Frame>
  );
}

/** A round passport stamp with a bowl in the middle and a tick of ink. First stamp to come. */
export function PassportStampIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  return (
    <Frame size={size} testID={testID}>
      <Rect x="8" y="10" width="48" height="44" rx="5" fill={palette.bgSoft} />
      <Circle
        cx="32"
        cy="32"
        r="17"
        fill="none"
        stroke={palette.orange}
        strokeWidth="2"
        strokeDasharray="4 2"
      />
      <Circle cx="32" cy="32" r="12" fill={palette.orangeLight} />
      <Bowl cx={32} cy={30} fill={palette.orange} rim={palette.orangeDark} />
      <Path d="M44,48 L50,42" stroke={palette.amber} strokeWidth="3" strokeLinecap="round" />
    </Frame>
  );
}

/** Two speech bubbles, the front one holding three stars. No reviews here yet. */
export function ReviewBubblesIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  const star = (cx: number, cy: number, fill: string) => (
    <Path
      key={`${cx}-${cy}`}
      d={`M${cx},${cy - 4} L${cx + 1.2},${cy - 1.2} L${cx + 4},${cy - 1} L${cx + 1.8},${cy + 1} L${cx + 2.5},${cy + 4} L${cx},${cy + 2.4} L${cx - 2.5},${cy + 4} L${cx - 1.8},${cy + 1} L${cx - 4},${cy - 1} L${cx - 1.2},${cy - 1.2} Z`}
      fill={fill}
    />
  );
  return (
    <Frame size={size} testID={testID}>
      <Path
        d="M30,8 H54 A4,4 0 0 1 58,12 V28 A4,4 0 0 1 54,32 H50 L46,38 L44,32 H30 A4,4 0 0 1 26,28 V12 A4,4 0 0 1 30,8 Z"
        fill={palette.amberLight}
      />
      <Path
        d="M10,22 H40 A4,4 0 0 1 44,26 V44 A4,4 0 0 1 40,48 H22 L16,56 L16,48 H10 A4,4 0 0 1 6,44 V26 A4,4 0 0 1 10,22 Z"
        fill={palette.orangeLight}
        stroke={palette.orange}
        strokeWidth="1.5"
      />
      {star(15, 35, palette.orange)}
      {star(25, 35, palette.orange)}
      {star(35, 35, palette.textMuted)}
    </Frame>
  );
}

/** A padlock with a heart on it. A private account: follow to see what they eat. */
export function LockHeartIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  return (
    <Frame size={size} testID={testID}>
      <Path
        d="M22,28 V20 A10,10 0 0 1 42,20 V28"
        stroke={palette.textMuted}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <Rect x="14" y="27" width="36" height="28" rx="6" fill={palette.orange} />
      <Path
        d="M32,48 C26,43 23,40 23,36.5 C23,34 25,32 27.5,32 C29.5,32 31,33 32,34.5 C33,33 34.5,32 36.5,32 C39,32 41,34 41,36.5 C41,40 38,43 32,48 Z"
        fill={palette.surface}
      />
    </Frame>
  );
}

/** A hawker storefront with a striped awning. Stalls you add or have not photographed. */
export function StorefrontIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  const stripes = [8, 20, 32, 44];
  return (
    <Frame size={size} testID={testID}>
      <Rect x="10" y="26" width="44" height="30" rx="2" fill={palette.bgSoft} />
      {stripes.map((x, index) => (
        <Path
          key={x}
          d={`M${x},14 H${x + 12} V24 A6,6 0 0 1 ${x},24 Z`}
          fill={index % 2 === 0 ? palette.orange : palette.amber}
        />
      ))}
      <Rect x="18" y="36" width="12" height="20" rx="1.5" fill={palette.orangeLight} />
      <Rect x="36" y="34" width="12" height="10" rx="1.5" fill={palette.surface} />
      <Bowl cx={42} cy={37} fill={palette.orange} rim={palette.orangeDark} />
      <Line
        x1="4"
        y1="56"
        x2="60"
        y2="56"
        stroke={palette.border}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Frame>
  );
}

/** A camera over a plate. A dish waiting for its first photo. */
export function CameraPlateIllustration({ size = 96, testID }: IllustrationProps) {
  const { palette } = useHungryTheme();
  return (
    <Frame size={size} testID={testID}>
      <Circle
        cx="32"
        cy="46"
        r="15"
        fill={palette.bgSoft}
        stroke={palette.border}
        strokeWidth="1.5"
      />
      <Circle cx="32" cy="46" r="9" fill={palette.amberLight} />
      <Rect x="14" y="10" width="36" height="24" rx="5" fill={palette.orange} />
      <Rect x="24" y="6" width="12" height="6" rx="2" fill={palette.orangeDark} />
      <Circle cx="32" cy="22" r="7.5" fill={palette.surface} />
      <Circle cx="32" cy="22" r="4" fill={palette.orangeLight} />
      <Circle cx="44" cy="15" r="1.8" fill={palette.surface} />
    </Frame>
  );
}
