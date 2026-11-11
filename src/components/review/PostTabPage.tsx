import { View } from "react-native";

import { AppText, Button, Screen } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useHungryTheme } from "@/theme";

/**
 * The Post page that sits between Home and Reviews in the swipe order. The Post button opens the
 * review card from the bottom; this page is what the edge swipe passes through on the way, with
 * the same way in.
 */
export function PostTabPage({ onStart }: { onStart: () => void }) {
  const { palette, spacing } = useHungryTheme();
  return (
    <Screen title="Post" showBack={false} scroll={false}>
      <View
        style={{ flex: 1, justifyContent: "center", gap: spacing[4], paddingBottom: spacing[8] }}
      >
        <AppText variant="h2" accessibilityRole="header">
          What did you eat?
        </AppText>
        <AppText variant="body" style={{ color: palette.textSecondary }}>
          Add the dish, a photo and how it tasted, so the next person can find it.
        </AppText>
        <Button
          label={FEATURE_FLAGS.foodPortfolioEnabled ? "Add a dish" : "Write a review"}
          onPress={onStart}
          fullWidth
        />
      </View>
    </Screen>
  );
}
