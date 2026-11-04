import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { FlowProgressBar } from "@/components/onboarding/FlowProgressBar";
import type { OnboardingFlowScreen } from "@/features/onboarding/onboardingFlow";
import { useHungryTheme } from "@/theme";

const ACTIONS_HORIZONTAL_PADDING = 24;
const ACTIONS_GAP = 10;
const ACTIONS_BOTTOM_PADDING = 28;

type Props = {
  screen: OnboardingFlowScreen;
  onBack: () => void;
  children: ReactNode;
  /** Buttons and links at the bottom: Continue first, then any Skip links. */
  footer?: ReactNode;
  /** false: the children lay out themselves (a screen that must not scroll). */
  scroll?: boolean;
};

/** Back arrow and the one progress bar on top, the content in the middle, buttons below. */
export function OnboardingFrame({ screen, onBack, children, footer, scroll = true }: Props) {
  const { palette, spacing } = useHungryTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.bg }}
      edges={["top", "left", "right", "bottom"]}
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[2],
          minHeight: 64,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[3],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
        >
          <ArrowLeft color={palette.text} size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <FlowProgressBar screen={screen} />
        </View>
      </View>

      {scroll ? (
        <ScrollView
          contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[3] }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, gap: spacing[3], paddingHorizontal: spacing[3] }}>{children}</View>
      )}

      {footer ? (
        <View
          style={{
            gap: ACTIONS_GAP,
            paddingBottom: ACTIONS_BOTTOM_PADDING,
            paddingHorizontal: ACTIONS_HORIZONTAL_PADDING,
            paddingTop: spacing[3],
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
