import { View } from "react-native";

import { Skeleton } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/** Placeholder tiles while the first page of posts loads, so "No posts yet" does not flash. */
export function ProfileGridSkeleton() {
  const { spacing } = useHungryTheme();
  return (
    <View
      accessibilityLabel="Loading posts"
      style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing[4] }}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <View key={index} style={{ width: "33.333%", aspectRatio: 1, padding: 1 }}>
          <Skeleton height="100%" borderRadius={0} />
        </View>
      ))}
    </View>
  );
}

/** Placeholder review cards while a profile's reviews load. */
export function ProfileReviewsSkeleton() {
  const { componentRadii, spacing } = useHungryTheme();
  return (
    <View accessibilityLabel="Loading reviews" style={{ gap: spacing[3] }}>
      <Skeleton height={spacing[16]} borderRadius={componentRadii.card} />
      <Skeleton height={spacing[16]} borderRadius={componentRadii.card} />
    </View>
  );
}
