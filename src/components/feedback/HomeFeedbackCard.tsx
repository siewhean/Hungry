import { useState } from "react";
import { Pressable, View } from "react-native";

import { FeedbackSheet } from "@/components/feedback/FeedbackSheet";
import { AppSymbol, AppText } from "@/components/ui";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useHungryTheme } from "@/theme";

/** A card on Home that opens the same Send feedback sheet as Settings. */
export function HomeFeedbackCard() {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send feedback"
        accessibilityHint="Tell us what you like or what to fix"
        onPress={() => {
          trackAnalyticsEvent("feedback_opened", { source: "home_card" });
          setOpen(true);
        }}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing[3],
          minHeight: 64,
          opacity: pressed ? 0.92 : 1,
          padding: spacing[4],
        })}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.orangeLight,
            borderRadius: componentRadii.button,
            height: 40,
            justifyContent: "center",
            width: 40,
          }}
        >
          <AppSymbol name="feedback" size={20} color={palette.orange} />
        </View>
        <View style={{ flex: 1, gap: spacing[0.5] }}>
          <AppText variant="bodyBold">Help us make Hungry better</AppText>
          <AppText variant="bodySmall" style={{ color: palette.textSecondary }}>
            Tell us what you like or what to fix.
          </AppText>
        </View>
        <AppSymbol name="chevronRight" size={16} color={palette.textMuted} />
      </Pressable>
      <FeedbackSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
