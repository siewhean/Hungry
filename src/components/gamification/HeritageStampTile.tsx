import { View } from "react-native";

import { PassportStampArt } from "@/components/gamification/PassportStampArt";
import { AppText } from "@/components/ui/AppText";
import { useHungryTheme } from "@/theme";

type Props = {
  title: string;
  subtitle: string;
  /** The small accent line under the subtitle, e.g. "3 stalls" or "Locked". */
  detail: string;
  earned: boolean;
  width: number;
  categoryId: string;
  /** The stamp's level, from 0 (first stamp) to 3 (completed). */
  level: number;
};

/** One circular stamp in the Passport's three-column "Heritage Stamps" grid. */
export function HeritageStampTile({
  title,
  subtitle,
  detail,
  earned,
  width,
  categoryId,
  level,
}: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const ring = Math.min(84, width - spacing[3]);
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
      <View style={{ marginBottom: spacing[1] }}>
        <PassportStampArt categoryId={categoryId} level={level} earned={earned} size={ring} />
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
