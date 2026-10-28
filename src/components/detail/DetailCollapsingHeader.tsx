import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";

import { AppText } from "@/components/ui/AppText";
import { useHungryTheme } from "@/theme";
import { FloatingBackButton } from "./FloatingBackButton";

type Props = {
  /** The page's vertical scroll offset (the same value DetailHeroFade reads). */
  scrollY: Animated.Value;
  /** Height of the hero photo: the bar fades in between 60% and 100% of it. */
  heroHeight: number;
  /** The stall or dish name shown in the bar once the page's own title has scrolled away. */
  title: string;
  onBack: () => void;
  /** Share in the opposite corner; left out when the page has no share. */
  onShare?: () => void;
  shareLabel?: string;
  shareIcon?: LucideIcon;
  /** Test id of the wrapper that holds the buttons and the bar. */
  chromeTestID?: string;
  /** Test id of the bar itself. */
  testID?: string;
};

/** Room the bar leaves below the safe area for the 44pt buttons and their margin. */
const BAR_CONTENT_HEIGHT = 60;

/**
 * The only chrome on dish and stall pages. Over the photo it is two round buttons; once the
 * photo has faded, a surface bar with a hairline and the name fades in behind them, so the
 * page always has a title and content never runs under bare buttons.
 *
 * Back comes first in the tree so screen readers reach it first. The name in the bar is
 * hidden from screen readers while the page's own heading is on screen, and read as a
 * heading once the bar is showing.
 */
export function DetailCollapsingHeader({
  scrollY,
  heroHeight,
  title,
  onBack,
  onShare,
  shareLabel = "Share",
  shareIcon,
  chromeTestID = "detail-top-chrome",
  testID = "detail-collapsing-header",
}: Props) {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const start = Math.max(1, heroHeight * 0.6);
  const end = Math.max(start + 1, heroHeight);
  const barOpacity = scrollY.interpolate({
    inputRange: [0, start, end],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });

  // One state flip when the bar becomes visible: not a re-render per scroll event.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const next = value >= (start + end) / 2;
      setCollapsed((current) => (current === next ? current : next));
    });
    return () => scrollY.removeListener(id);
  }, [end, scrollY, start]);

  const height = insets.top + BAR_CONTENT_HEIGHT;
  // Buttons are 44pt wide at spacing[4]: keep the name clear of both.
  const sideInset = spacing[4] + 44 + spacing[2];

  return (
    <View
      pointerEvents="box-none"
      testID={chromeTestID}
      style={{ elevation: 10, height, left: 0, position: "absolute", right: 0, top: 0, zIndex: 10 }}
    >
      <View
        pointerEvents="box-none"
        style={{ ...StyleSheet.absoluteFill, elevation: 12, zIndex: 2 }}
      >
        <FloatingBackButton onPress={onBack} />
        {onShare ? (
          <FloatingBackButton
            accessibilityLabel={shareLabel}
            icon={shareIcon}
            onPress={onShare}
            side="right"
          />
        ) : null}
      </View>
      <Animated.View
        pointerEvents="none"
        testID={testID}
        style={{
          ...StyleSheet.absoluteFill,
          backgroundColor: palette.surface,
          borderBottomColor: palette.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
          justifyContent: "flex-end",
          opacity: barOpacity,
        }}
      >
        <View
          style={{
            alignItems: "center",
            height: BAR_CONTENT_HEIGHT,
            justifyContent: "center",
            paddingHorizontal: sideInset,
          }}
        >
          <AppText
            variant="bodyBold"
            numberOfLines={1}
            accessibilityRole="header"
            aria-hidden={!collapsed}
            accessibilityElementsHidden={!collapsed}
            importantForAccessibility={collapsed ? "yes" : "no-hide-descendants"}
            style={{ textAlign: "center" }}
          >
            {title}
          </AppText>
        </View>
      </Animated.View>
    </View>
  );
}
