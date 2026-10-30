import type { PropsWithChildren, ReactElement, ReactNode, RefObject } from "react";
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
  const { onScroll, scrollEventThrottle } = useScrollToRevealBack();

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
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.content,
        !fullWidth && { alignItems: "center", paddingHorizontal: semanticSpacing.screenEdge },
        {
          paddingBottom: Math.max(insets.bottom, spacing[8]) + spacing[12],
          paddingTop: spacing[3],
        },
        contentContainerStyle,
      ]}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      <View
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
        paddingBottom: Math.max(insets.bottom, spacing[3]),
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
