import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useComposerStore, ComposerTab } from "../useComposerStore";

export function TabSwitcher() {
  const { palette, spacing, semanticSpacing, radii, shadows } = useHungryTheme();
  const activeTab = useComposerStore((state) => state.activeTab);
  const setActiveTab = useComposerStore((state) => state.setActiveTab);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.bg,
          borderBottomColor: palette.border,
          paddingHorizontal: semanticSpacing.screenEdge,
          paddingVertical: semanticSpacing.inlineGaps,
        },
      ]}
    >
      <View
        style={[
          styles.inner,
          { backgroundColor: palette.bgSoft, borderRadius: radii.pill, padding: 4 },
        ]}
      >
        <View
          style={[
            styles.indicatorContainer,
            {
              left: activeTab === "post" ? 4 : "50%",
              width: "48%",
              backgroundColor: palette.surface,
              borderRadius: radii.pill,
              ...shadows.card,
            },
          ]}
        />
        <Pressable
          style={styles.tab}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("post");
          }}
        >
          <AppText
            variant="bodyBold"
            style={{
              color: activeTab === "post" ? palette.orange : palette.textMuted,
              fontSize: 13,
            }}
          >
            POST
          </AppText>
        </Pressable>
        <Pressable
          style={styles.tab}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("review");
          }}
        >
          <AppText
            variant="bodyBold"
            style={{
              color: activeTab === "review" ? palette.orange : palette.textMuted,
              fontSize: 13,
            }}
          >
            REVIEW
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    zIndex: 10,
  },
  inner: {
    flexDirection: "row",
    height: 36,
    position: "relative",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  indicatorContainer: {
    position: "absolute",
    top: 4,
    bottom: 4,
    zIndex: 1,
  },
});
