import { View } from "react-native";

import { StallLogoMark } from "@/components/stall/StallLogoMark";
import { useHungryTheme } from "@/theme";

type Props = {
  name: string;
  logoUrl?: string;
  width: number;
  height: number;
};

/**
 * The hero of a stall with no photo (almost every stall today, and any stall whose photos
 * all failed to load): a brand-tinted band with the stall's logo, or its initials when it
 * has none, instead of a grey box.
 */
export function StallHeroFallback({ name, logoUrl, width, height }: Props) {
  const { palette, spacing } = useHungryTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${name} photo unavailable`}
      style={{
        alignItems: "center",
        backgroundColor: palette.orangeLight,
        height,
        justifyContent: "center",
        paddingTop: spacing[6],
        width,
      }}
    >
      <StallLogoMark logoUrl={logoUrl} name={name} size={Math.min(96, height - spacing[8])} />
    </View>
  );
}
