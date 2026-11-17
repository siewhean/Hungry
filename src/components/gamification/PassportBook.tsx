import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { PassportBadgeImage } from "@/components/gamification/PassportBadgeImage";
import { PassportCover } from "@/components/gamification/PassportCover";
import { PASSPORT_TEXTURE_ASSETS } from "@/components/gamification/passportAssets";
import { isPassportBadgeEarned } from "@/constants/passportConfig";
import { useHungryTheme } from "@/theme";
import type {
  EarnedPassportStamp,
  PassportBadgeDefinition,
  PassportNextStamp,
} from "@/types/domain";

interface PassportBookProps {
  earnedStamps: EarnedPassportStamp[];
  badges: PassportBadgeDefinition[];
  nextStamp: PassportNextStamp | null;
}

export function PassportBook({ earnedStamps, badges, nextStamp }: PassportBookProps) {
  const { componentRadii, palette, spacing, shadows } = useHungryTheme();
  const earnedStampCount = earnedStamps.length;
  const earnedBadges = badges.filter((badge) => isPassportBadgeEarned(badge, earnedStamps));

  return (
    <View style={{ gap: spacing[4] }}>
      <PassportCover
        earnedStampCount={earnedStampCount}
        nextLabel={nextStamp ? nextStamp.category.name : undefined}
      />

      <View
        style={[
          shadows.card,
          styles.identityPage,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: componentRadii.card,
            borderWidth: 1,
            gap: spacing[4],
            padding: spacing[4],
          },
        ]}
      >
        <AccessibleImage
          cachePolicy="memory-disk"
          contentFit="cover"
          decorative
          source={PASSPORT_TEXTURE_ASSETS.paperSpread}
          style={[StyleSheet.absoluteFill, styles.paperTexture]}
        />
        <View style={{ gap: spacing[1] }}>
          <AppText variant="micro" style={{ color: palette.accentText, fontWeight: "900" }}>
            REPUBLIC OF HUNGRY
          </AppText>
          <AppText variant="h3">Food Discovery Passport</AppText>
          <AppText tone="muted" variant="bodySmall">
            A record of Singapore food trails, neighbourhood finds, and useful contributions.
          </AppText>
        </View>
        <View style={[styles.metaGrid, { gap: spacing[3] }]}>
          <PassportMeta label="Stamps" value={earnedStampCount.toString()} />
          <PassportMeta
            label="Next mark"
            value={nextStamp ? `${nextStamp.remainingCount} away` : "Complete"}
          />
        </View>
        <View style={[styles.badgeRail, { gap: spacing[2] }]}>
          {badges.map((badge) => (
            <PassportBadgeImage
              key={badge.id}
              badge={badge}
              earned={earnedBadges.some((earnedBadge) => earnedBadge.id === badge.id)}
              size={58}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function PassportMeta({ label, value }: { label: string; value: string }) {
  const { palette, radii, spacing } = useHungryTheme();
  return (
    <View
      style={[
        styles.metaBox,
        { borderColor: palette.border, borderRadius: radii.md, padding: spacing[3] },
      ]}
    >
      <AppText tone="muted" variant="micro">
        {label}
      </AppText>
      <AppText variant="bodySmallBold">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRail: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  identityPage: {
    overflow: "hidden",
  },
  metaBox: {
    borderWidth: 1,
    flex: 1,
  },
  metaGrid: {
    flexDirection: "row",
  },
  paperTexture: {
    opacity: 0.3,
  },
});
