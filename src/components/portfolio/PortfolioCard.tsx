import { Pressable, View } from "react-native";
import { FolderHeart } from "lucide-react-native";

import { AccessibleImage, AppSymbol, AppText } from "@/components/ui";
import { formatPortfolioSummary, isPortfolioLive } from "@/features/checklistPortfolio/listLabels";
import { tapHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";
import type { Portfolio } from "@/types/domain";

interface PortfolioCardProps {
  portfolio: Portfolio;
  itemCount?: number;
  /** Dish photos from the list's first items; the first is the cover. */
  coverPhotos?: readonly string[];
  onPress: () => void;
}

const COVER_SIZE = 76;

function getPortfolioSubtitle(portfolio: Portfolio, itemCount: number): string {
  return formatPortfolioSummary(portfolio, itemCount);
}

/**
 * A list as one row: a square cover photo (or a folder on a soft tint while it has none), the
 * name, who can see it and how many places it holds. The whole row is one tap target.
 */
export function PortfolioCard({
  portfolio,
  itemCount = 0,
  coverPhotos = [],
  onPress,
}: PortfolioCardProps) {
  const { componentRadii, palette, shadows, spacing } = useHungryTheme();
  const cover = coverPhotos[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${portfolio.name}`}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        shadows.card,
        {
          alignItems: "center",
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing[3],
          minHeight: COVER_SIZE + spacing[3] * 2,
          opacity: pressed ? 0.88 : 1,
          padding: spacing[3],
        },
      ]}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.orangeLight,
          borderRadius: componentRadii.button,
          height: COVER_SIZE,
          justifyContent: "center",
          overflow: "hidden",
          width: COVER_SIZE,
        }}
      >
        {cover ? (
          <AccessibleImage
            source={{ uri: cover }}
            decorative
            contentFit="cover"
            style={{ height: COVER_SIZE, width: COVER_SIZE }}
          />
        ) : (
          <FolderHeart color={palette.orange} size={28} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyBold" numberOfLines={2}>
          {portfolio.name}
        </AppText>
        <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
          {getPortfolioSubtitle(portfolio, itemCount)}
        </AppText>
        {/* Who can see the list is in the subtitle; only a live (public) list gets a badge. */}
        {isPortfolioLive(portfolio) ? (
          <AppText variant="micro" tone="success">
            Published
          </AppText>
        ) : null}
      </View>
      <AppSymbol name="chevronRight" size={14} color={palette.textMuted} />
    </Pressable>
  );
}
