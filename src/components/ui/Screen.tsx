import {
  useCallback,
  useState,
  type ComponentProps,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useIsInsideMainTabs } from "@/hooks/useIsInsideMainTabs";
import { useKeyboardRevealFocusedInput } from "@/hooks/useKeyboardRevealFocusedInput";
import { useScrollToRevealBack } from "@/hooks/useScrollToRevealBack";
import { useHungryTheme, type HungryTheme } from "@/theme";
import { AppHeader } from "./AppHeader";

interface ScreenProps {
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  /** Replaces the back button (e.g. a Cancel text button on a modal editor). */
  headerLeft?: ReactNode;
  showBack?: boolean;
  /** Replaces the header back button's goBack (e.g. to confirm discarding unsaved changes). */
  onBackPress?: () => void;
  headerGap?: number;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  /** Lifts the content above the iOS keyboard (forms). Android resizes the window itself. */
  keyboardAvoiding?: boolean;
  /** Pull-to-refresh for a scrolling screen. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Pinned below the scrolling content (e.g. a form's Save button). */
  footer?: ReactNode;
}

export function Screen({
  children,
  title,
  subtitle,
  headerRight,
  headerLeft,
  showBack = true,
  onBackPress,
  headerGap,
  scroll = true,
  style,
  contentContainerStyle,
  fullWidth = false,
  scrollRef,
  keyboardAvoiding = false,
  refreshControl,
  footer,
}: PropsWithChildren<ScreenProps>) {
  const { palette, spacing, semanticSpacing } = useHungryTheme();
  const styles = createStyles(spacing);
  const effectiveHeaderGap = headerGap ?? spacing[5];
  const insets = useSafeAreaInsets();
  const insideTabs = useIsInsideMainTabs();
  const { onScroll: onScrollRevealBack, scrollEventThrottle } = useScrollToRevealBack();
  // A tapped text box must stay in view: on a form the keyboard lifts the page (above) and this
  // scrolls the focused box clear of the keyboard; elsewhere iOS insets the scroll view itself.
  const reveal = useKeyboardRevealFocusedInput();
  const setScrollNode = useCallback(
    (node: ScrollView | null) => {
      (reveal.scrollRef as { current: ScrollView | null }).current = node;
      if (scrollRef) (scrollRef as { current: ScrollView | null }).current = node;
    },
    [reveal.scrollRef, scrollRef],
  );
  const onScroll: NonNullable<ComponentProps<typeof ScrollView>["onScroll"]> = (event) => {
    onScrollRevealBack(event);
    reveal.onScroll(event);
  };
  // A page whose content fits on the screen does not scroll or rubber-band: pulling it only
  // made the page look loose. Pull to refresh keeps its bounce.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const contentFits =
    viewportHeight > 0 &&
    contentHeight > 0 &&
    contentHeight <= viewportHeight + 1 &&
    !refreshControl;

  const header =
    title || headerRight || headerLeft ? (
      <AppHeader
        title={title}
        subtitle={subtitle}
        showBack={showBack}
        onBackPress={onBackPress}
        left={headerLeft}
        right={headerRight}
        horizontalPadding={fullWidth ? semanticSpacing.screenEdge : 0}
      />
    ) : null;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      ref={setScrollNode}
      alwaysBounceVertical={!contentFits}
      bounces={!contentFits}
      overScrollMode={contentFits ? "never" : "auto"}
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      onContentSizeChange={(_width, height) => setContentHeight(height)}
      automaticallyAdjustKeyboardInsets={!keyboardAvoiding}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.content,
        !fullWidth && { alignItems: "center", paddingHorizontal: semanticSpacing.screenEdge },
        {
          // Under the tab bar the home indicator is already cleared, so only a small gap.
          paddingBottom: (insideTabs ? 0 : insets.bottom) + spacing[6],
          paddingTop: spacing[3],
        },
        contentContainerStyle,
      ]}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      refreshControl={refreshControl}
    >
      <View
        onFocus={keyboardAvoiding ? reveal.onFocus : undefined}
        style={[
          styles.inner,
          fullWidth && { maxWidth: undefined },
          !fullWidth && { gap: effectiveHeaderGap },
        ]}
      >
        {header}
        {children}
      </View>
    </ScrollView>
  ) : (
    <View
      style={[
        styles.flex,
        !fullWidth && {
          alignItems: "center",
          paddingHorizontal: semanticSpacing.screenEdge,
          paddingTop: spacing[3],
        },
      ]}
    >
      <View
        style={[
          styles.inner,
          styles.flex,
          fullWidth && { maxWidth: undefined },
          !fullWidth && { gap: effectiveHeaderGap },
        ]}
      >
        {header}
        {children}
      </View>
    </View>
  );

  const pinnedFooter = footer ? (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: palette.border,
        backgroundColor: palette.bg,
        paddingTop: spacing[3],
        paddingBottom: Math.max(insets.bottom - spacing[2], spacing[3]),
        paddingHorizontal: semanticSpacing.screenEdge,
        alignItems: "center",
      }}
    >
      <View style={styles.inner}>{footer}</View>
    </View>
  ) : null;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }, style]}
      edges={["top", "left", "right"]}
    >
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          {body}
          {pinnedFooter}
        </KeyboardAvoidingView>
      ) : (
        <>
          {body}
          {pinnedFooter}
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (spacing: HungryTheme["spacing"]) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    flex: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
    },
    inner: {
      maxWidth: 440,
      width: "100%",
    },
  });
