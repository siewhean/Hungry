import { View } from "react-native";
import { Lock, Stamp } from "lucide-react-native";

import { AppText } from "@/components/ui/AppText";
import { useHungryTheme } from "@/theme";

type Props = {
  title: string;
  subtitle: string;
  /** The small accent line under the subtitle, e.g. "3 stalls" or "Locked". */
  detail: string;
  earned: boolean;
  width: number;
};

/** One circular stamp in the Passport's three-column "Heritage Stamps" grid. */
export function HeritageStampTile({ title, subtitle, detail, earned, width }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const ring = Math.min(76, width - spacing[4]);
  return (
    <View
      accessible
      accessibilityLabel={`${title}, ${subtitle}. ${earned ? detail : "Locked"}`}
      style={{
        alignItems: "center",
        backgroundColor: earned ? palette.surface : palette.bgSoft,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        gap: spacing[1],
        opacity: earned ? 1 : 0.72,
        paddingHorizontal: spacing[1.5],
        paddingVertical: spacing[3],
        width,
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: earned ? palette.orangeLight : palette.border,
          borderRadius: ring / 2,
          height: ring,
          justifyContent: "center",
          marginBottom: spacing[1],
          width: ring,
        }}
      >
        <View
          style={{
            alignItems: "center",
            borderColor: earned ? palette.orange : palette.textMuted,
            borderRadius: (ring - 12) / 2,
            borderStyle: "dashed",
            borderWidth: 1.5,
            height: ring - 12,
            justifyContent: "center",
            width: ring - 12,
          }}
        >
          {earned ? (
            <Stamp color={palette.orange} size={26} />
          ) : (
            <Lock color={palette.textMuted} size={22} />
          )}
        </View>
      </View>
      <AppText variant="bodySmallBold" numberOfLines={2} style={{ textAlign: "center" }}>
        {title}
      </AppText>
      <AppText variant="micro" tone="muted" numberOfLines={1} style={{ textAlign: "center" }}>
        {subtitle}
      </AppText>
      <AppText
        variant="micro"
        numberOfLines={1}
        style={{
          color: earned ? palette.orangeText : palette.textMuted,
          fontWeight: "800",
          textAlign: "center",
        }}
      >
        {earned ? detail : "Locked"}
      </AppText>
    </View>
  );
}
