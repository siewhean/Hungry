import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Switch } from "react-native";
import {
  Music,
  Sparkles,
  Calendar,
  Eye,
  Megaphone,
  Tag,
  BarChart3,
  TrendingUp,
  Clock,
  ChevronRight,
  X,
} from "lucide-react-native";
import { AppText, Input, Card, Badge, IconButton, Button, Dialog } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "../useComposerStore";
import { spacing, semanticSpacing } from "@/theme/tokens";

export function PostTab({ onOpenMusic }: { onOpenMusic?: () => void }) {
  const { componentRadii, palette, radii, shadows, spacing } = useHungryTheme();
  const postCaption = useComposerStore((state) => state.postCaption);
  const reviewCaption = useComposerStore((state) => state.reviewCaption);
  const setCaption = useComposerStore((state) => state.setCaption);
  const useSameCaption = useComposerStore((state) => state.useSameCaption);
  const setUseSameCaption = useComposerStore((state) => state.setUseSameCaption);
  const showFoodContextOverlay = useComposerStore((state) => state.showFoodContextOverlay);
  const setShowFoodContextOverlay = useComposerStore((state) => state.setShowFoodContextOverlay);
  const musicId = useComposerStore((state) => state.musicId);
  const selectedTrackName = useComposerStore((state) => state.selectedTrackName);
  const selectedTrackArtist = useComposerStore((state) => state.selectedTrackArtist);
  const isSponsored = useComposerStore((state) => state.isSponsored);
  const setIsSponsored = useComposerStore((state) => state.setIsSponsored);
  const setShowPreview = useComposerStore((state) => state.setShowPreview);
  const isBusinessMode = useComposerStore((state) => state.isBusinessMode);
  const ctaButton = useComposerStore((state) => state.ctaButton);
  const setCTA = useComposerStore((state) => state.setCTA);

  const [dialogConfig, setDialogConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
  } | null>(null);

  return (
    <View
      style={[
        styles.container,
        { padding: semanticSpacing.screenEdge, gap: semanticSpacing.componentGap },
      ]}
    >
      {/* Caption Section */}
      <View style={styles.section}>
        <AppText variant="bodyBold" style={{ marginBottom: semanticSpacing.inlineGaps }}>
          Caption
        </AppText>
        <Input
          multiline
          numberOfLines={6}
          placeholder="Write your masterpiece... Use @ to tag or # for topics."
          value={postCaption}
          onChangeText={setCaption}
          editable={!useSameCaption}
          style={{
            backgroundColor: palette.surface,
            borderRadius: componentRadii.input,
            opacity: useSameCaption ? 0.6 : 1,
            minHeight: 120,
          }}
        />

        {/* Sync Toggle */}
        {reviewCaption.length > 0 && (
          <View
            style={[
              styles.syncBar,
              {
                backgroundColor: palette.orangeLight,
                borderRadius: componentRadii.card,
                marginTop: semanticSpacing.componentGap,
                paddingHorizontal: semanticSpacing.screenEdge,
                paddingVertical: semanticSpacing.inlineGaps,
              },
            ]}
          >
            <AppText variant="micro" style={{ color: palette.orange, fontWeight: "700", flex: 1 }}>
              USE SAME CAPTION AS REVIEW
            </AppText>
            <Switch
              value={useSameCaption}
              onValueChange={setUseSameCaption}
              trackColor={{ false: palette.border, true: palette.orange }}
              thumbColor={palette.white}
              style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
            />
          </View>
        )}
      </View>

      <View
        style={[
          styles.overlayToggleRow,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: componentRadii.card,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg, flex: 1 }}>
          <Eye size={20} color={showFoodContextOverlay ? palette.orange : palette.text} />
          <View style={{ flex: 1 }}>
            <AppText
              variant="bodySmallBold"
              style={{ color: showFoodContextOverlay ? palette.orange : palette.text }}
            >
              Dish title on post
            </AppText>
            <AppText variant="micro" tone="secondary" style={{ marginTop: 2 }}>
              Food title and stall name
            </AppText>
          </View>
        </View>
        <Switch
          value={showFoodContextOverlay}
          onValueChange={setShowFoodContextOverlay}
          trackColor={{ false: palette.border, true: palette.orange }}
          thumbColor={palette.white}
          accessibilityLabel="Show food title and stall name on post"
          accessibilityHint="Adds or removes the bottom-left label on post media"
          style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
        />
      </View>

      {/* Music Section */}
      <Pressable
        onPress={onOpenMusic}
        style={({ pressed }) => [
          styles.interactiveRow,
          {
            backgroundColor: pressed ? palette.surfaceRaised : palette.surface,
            borderRadius: componentRadii.button,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg, flex: 1 }}>
          <Music size={20} color={musicId ? palette.orange : palette.text} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold" style={{ color: musicId ? palette.orange : palette.text }}>
              {musicId ? "Background Music" : "Add Music"}
            </AppText>
            {musicId && (
              <AppText variant="micro" tone="secondary" style={{ marginTop: 2 }}>
                {`${selectedTrackName} • ${selectedTrackArtist}`}
              </AppText>
            )}
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing["2"] }}>
          {musicId && (
            <IconButton
              icon={<X size={14} color={palette.textMuted} />}
              accessibilityLabel="Remove music"
              onPress={() => useComposerStore.getState().setMusic(null)}
              style={{ width: 24, height: 24, padding: 0 }}
            />
          )}
          <ChevronRight size={18} color={palette.textMuted} style={{ marginLeft: spacing.md }} />
        </View>
      </Pressable>

      {/* Business Features */}
      {isBusinessMode && (
        <View style={styles.section}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: semanticSpacing.inlineGaps,
              marginBottom: semanticSpacing.componentGap,
            }}
          >
            <Megaphone size={18} color={palette.navy} />
            <AppText variant="bodyBold">Business & Promotions</AppText>
          </View>

          <View style={{ gap: semanticSpacing.inlineGaps }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${isSponsored ? "Disable" : "Enable"} sponsored label`}
              onPress={() => setIsSponsored(!isSponsored)}
              style={[
                styles.toggleRow,
                {
                  backgroundColor: isSponsored ? palette.orangeLight : palette.bgSoft,
                  borderRadius: componentRadii.card,
                  paddingHorizontal: semanticSpacing.componentGap,
                  paddingVertical: semanticSpacing.inlineGaps,
                },
              ]}
            >
              <AppText
                variant="bodySmallBold"
                style={{ color: isSponsored ? palette.orange : palette.text }}
              >
                Sponsored Label
              </AppText>
              <Badge label={isSponsored ? "ON" : "OFF"} tone={isSponsored ? "orange" : "neutral"} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add CTA Button"
              onPress={() => {
                setDialogConfig({
                  visible: true,
                  title: "Choose CTA",
                  message: "Select the action shown on this post.",
                });
              }}
              style={[
                styles.toggleRow,
                {
                  backgroundColor: palette.bgSoft,
                  borderRadius: componentRadii.card,
                  paddingHorizontal: semanticSpacing.componentGap,
                  paddingVertical: semanticSpacing.inlineGaps,
                },
              ]}
            >
              <AppText variant="bodySmallBold">Add CTA Button</AppText>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: semanticSpacing.textStack,
                }}
              >
                <AppText variant="micro" tone="muted">
                  {ctaButton ?? "None"}
                </AppText>
                <ChevronRight size={14} color={palette.textMuted} />
              </View>
            </Pressable>
          </View>
        </View>
      )}

      {dialogConfig && (
        <Dialog
          visible={dialogConfig.visible}
          title={dialogConfig.title}
          message={dialogConfig.message}
          onClose={() => setDialogConfig(null)}
          buttons={[
            { text: "Order Now", style: "default", onPress: () => setCTA("Order Now") },
            { text: "View Menu", style: "default", onPress: () => setCTA("View Menu") },
            { text: "Book Table", style: "default", onPress: () => setCTA("Book Table") },
            { text: "Remove CTA", style: "cancel", onPress: () => setCTA(null) },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  syncBar: {
    flexDirection: "row",
    alignItems: "center",
  },
  section: {
    gap: 2,
  },
  interactiveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "transparent",
  },
  overlayToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
