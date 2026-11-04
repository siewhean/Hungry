import { View } from "react-native";

import { Mascot } from "@/components/onboarding/Mascot";
import { TypingText } from "@/components/onboarding/TypingText";
import type { MascotPose } from "@/features/onboarding/mascot";
import { useHungryTheme } from "@/theme";

type Props = {
  pose: MascotPose;
  /** Names the line so it types in only the first time the screen is seen. */
  lineId: string;
  text: string;
  /** A small mascot, for screens where the picture is the hero (the taste sliders). */
  small?: boolean;
};

/** The mascot at the left and its line at the right, as on every question screen. */
export function MascotLine({ pose, lineId, text, small = false }: Props) {
  const { spacing } = useHungryTheme();
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
      <Mascot pose={pose} size={small ? 40 : 72} />
      <View style={{ flex: 1 }}>
        <TypingText lineId={lineId} text={text} />
      </View>
    </View>
  );
}
