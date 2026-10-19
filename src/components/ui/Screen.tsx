import type { PropsWithChildren, ReactNode, RefObject } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
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
  showBack?: boolean;
  /** Replaces the header back button's goBack (e.g. to confirm discarding unsaved changes). */
  onBackPress?: () => void;
  headerGap?: number;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  scrollRef?: RefObject<ScrollView>;
  /** Lifts the content above the iOS keyboard (forms). Android resizes the window itself. */
  keyboardAvoiding?: boolean;
}

export function Screen({
  children,
  title,
  subtitle,
  headerRight,
  showBack = true,
  onBackPress,
  headerGap,
  scroll = true,
  style,
  contentContainerStyle,
  fullWidth = false,
  scrollRef,
  keyboardAvoiding = false,
}: PropsWithChildren<ScreenProps>) {
  const { palette, spacing, semanticSpacing } = useHungryTheme();
  const styles = createStyles(spacing);
  const effectiveHeaderGap = headerGap ?? spacing[5];
  const insets = useSafeAreaInsets();
  const { onScroll, scrollEventThrottle } = useScrollToRevealBack();

  const header =
    title || headerRight ? (
      <AppHeader
        title={title}
        subtitle={subtitle}
        showBack={showBack}
        onBackPress={onBackPress}
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
        </KeyboardAvoidingView>
      ) : (
        body
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
