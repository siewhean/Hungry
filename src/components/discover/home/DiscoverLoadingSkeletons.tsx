import { View } from "react-native";

import { Skeleton } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export function PopularFoodStyleSkeleton() {
  const { palette, radii, spacing, shadows, typography } = useHungryTheme();
  const bowlSize = 72;
  const labelGap = spacing[1.5];
  const labelLineHeight = typography.bodySmallBold.fontSize + spacing[1];
  const buttonHeight = bowlSize + labelGap + labelLineHeight * 2;

  return (
    <>
      {[0, 1, 2, 3].map((slot) => (
        <View
          key={`popular-food-loading-${slot}`}
          style={{ alignItems: "center", height: buttonHeight, width: 88 }}
        >
          <View
            style={[
              shadows.card,
              {
                alignItems: "center",
                backgroundColor: palette.surfaceRaised,
                borderColor: palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                height: bowlSize,
                justifyContent: "center",
                width: bowlSize,
              },
            ]}
          >
            <Skeleton width={bowlSize - 10} height={bowlSize - 10} borderRadius={radii.pill} />
          </View>
          <View
            style={{
              gap: spacing[1],
              marginTop: labelGap,
              minHeight: labelLineHeight * 2,
            }}
          >
            <Skeleton width={70} height={14} borderRadius={radii.sm} />
            <Skeleton width={54} height={14} borderRadius={radii.sm} />
          </View>
        </View>
      ))}
    </>
  );
}

export function DiscoverFoodRailLoadingSkeleton({
  cardWidth,
  imageHeight,
}: {
  cardWidth: number;
  imageHeight: number;
}) {
  const { colorScheme, componentRadii, palette, radii, spacing, shadows } = useHungryTheme();
  const isDark = colorScheme === "dark";

  return (
    <>
      {[0, 1, 2].map((slot) => (
        <View
          key={`discover-food-rail-loading-${slot}`}
          style={[
            shadows.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
              borderWidth: isDark ? 0 : 1,
              overflow: "hidden",
              width: cardWidth,
            },
          ]}
        >
          <Skeleton width="100%" height={imageHeight} borderRadius={0} />
          <View style={{ gap: spacing[1.5], padding: spacing[3] }}>
            <Skeleton width="82%" height={16} borderRadius={radii.sm} />
            <Skeleton width="58%" height={12} borderRadius={radii.sm} />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: spacing[1],
              }}
            >
              <Skeleton width={54} height={16} borderRadius={radii.sm} />
              <Skeleton width={44} height={14} borderRadius={radii.sm} />
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

export function DiscoverStallListLoadingSkeleton({ rowCount = 3 }: { rowCount?: number }) {
  const { colorScheme, componentRadii, palette, radii, spacing, shadows } = useHungryTheme();
  const isDark = colorScheme === "dark";

  return (
    <>
      {Array.from({ length: rowCount }, (_, slot) => (
        <View
          key={`discover-stall-list-loading-${slot}`}
          style={[
            shadows.card,
            {
              alignItems: "center",
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
              borderWidth: isDark ? 0 : 1,
              flexDirection: "row",
              gap: spacing[3],
              padding: spacing[3],
            },
          ]}
        >
          <Skeleton width={56} height={56} borderRadius={radii.pill} />
          <View style={{ flex: 1, gap: spacing[1.5] }}>
            <Skeleton width="72%" height={16} borderRadius={radii.sm} />
            <Skeleton width="48%" height={12} borderRadius={radii.sm} />
          </View>
          <Skeleton width={20} height={20} borderRadius={radii.pill} />
        </View>
      ))}
    </>
  );
}
