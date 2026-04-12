import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useScrollToRevealBack } from "@/hooks/useScrollToRevealBack";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

interface ScreenProps {
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  scroll?: boolean;
}

export function Screen({
  children,
  title,
  subtitle,
  headerRight,
  scroll = true,
}: PropsWithChildren<ScreenProps>) {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const { onScroll, scrollEventThrottle } = useScrollToRevealBack();
  const scrollBackVisible = useUIStore((state) => state.scrollBackVisible);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              alignItems: "center",
              paddingHorizontal: spacing[5],
              paddingBottom: spacing[12],
              paddingTop: spacing[3],
            },
          ]}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
        >
          <View style={[styles.inner, { gap: spacing[5] }]}>
            {(title || headerRight) && (
              <View
                style={[
                  styles.header,
                  {
                    paddingLeft: scrollBackVisible ? spacing[12] : 0,
                    paddingTop: scrollBackVisible ? spacing[8] : 0,
                  },
                ]}
              >
                <View style={styles.headerCopy}>
                  {title ? <AppText variant="h1">{title}</AppText> : null}
                  {subtitle ? <AppText tone="secondary">{subtitle}</AppText> : null}
                </View>
                {headerRight}
              </View>
            )}
            {children}
          </View>
        </ScrollView>
      ) : (
        <View
          style={[
            styles.flex,
            {
              alignItems: "center",
              paddingHorizontal: spacing[5],
              paddingBottom: spacing[12],
              paddingTop: spacing[3],
            },
          ]}
        >
          <View style={[styles.inner, { gap: spacing[5] }]}>
            {(title || headerRight) && (
              <View
                style={[
                  styles.header,
                  {
                    paddingLeft: scrollBackVisible ? spacing[12] : 0,
                    paddingTop: scrollBackVisible ? spacing[8] : 0,
                  },
                ]}
              >
                <View style={styles.headerCopy}>
                  {title ? <AppText variant="h1">{title}</AppText> : null}
                  {subtitle ? <AppText tone="secondary">{subtitle}</AppText> : null}
                </View>
                {headerRight}
              </View>
            )}
            {children}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
});
