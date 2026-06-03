import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { X, Check, Sun, Droplet, Wand2, Sparkles } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { AccessibleImage, AppText, IconButton, Badge, Dialog } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "../useComposerStore";

const DEFAULT_ADJUSTMENTS = { brightness: 1, contrast: 1, saturation: 1 };

interface Props {
  mediaId: string | null;
  onClose: () => void;
}

export function MediaEditor({ mediaId, onClose }: Props) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const [dialogConfig, setDialogConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
  } | null>(null);
  const media = useComposerStore((state) => state.media.find((item) => item.id === mediaId));
  const updateMediaAdjustment = useComposerStore((state) => state.updateMediaAdjustment);

  if (!mediaId || !media) return null;

  const adjustments = media.adjustments ?? DEFAULT_ADJUSTMENTS;
  const clampAdjustment = (value: number) => Math.min(1.35, Math.max(0.7, value));
  const applyMediaAdjustments = (
    nextAdjustments: Partial<typeof DEFAULT_ADJUSTMENTS>,
    title: string,
  ) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateMediaAdjustment(media.id, nextAdjustments);
    setDialogConfig({
      visible: true,
      title,
      message: "The media adjustment has been saved to this draft.",
    });
  };

  const handleAutoEnhance = () =>
    applyMediaAdjustments(
      { brightness: 1.08, contrast: 1.08, saturation: 1.12 },
      "Auto-enhance applied",
    );

  const handleFoodFilter = () =>
    applyMediaAdjustments(
      { brightness: 1.05, contrast: 1.12, saturation: 1.18 },
      "Food filter applied",
    );

  const handleLightAdjustment = () =>
    applyMediaAdjustments(
      { brightness: clampAdjustment(adjustments.brightness + 0.05) },
      "Light updated",
    );

  const handleColourAdjustment = () =>
    applyMediaAdjustments(
      { saturation: clampAdjustment(adjustments.saturation + 0.05) },
      "Colour updated",
    );

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg, zIndex: 1100 }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 60 }]}>
        <IconButton
          variant="ghost"
          onPress={onClose}
          icon={<X size={24} color={palette.text} />}
          accessibilityLabel="Close"
        />
        <AppText variant="h3">Edit Media</AppText>
        <IconButton
          variant="ghost"
          accessibilityLabel="Save"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onClose();
          }}
          icon={<Check size={24} color={palette.orange} />}
        />
      </View>

      {/* Main Image View */}
      <View style={[styles.imageContainer, { backgroundColor: palette.mediaBackdrop }]}>
        <AccessibleImage
          source={{ uri: media.uri }}
          style={styles.mainImage}
          contentFit="contain"
          accessibilityLabel="Selected media preview"
        />

        <View style={styles.floatingTools}>
          <Badge label="✨ AI ENHANCED" tone="orange" />
        </View>
      </View>

      {/* Tools Section */}
      <View style={[styles.footer, { backgroundColor: palette.surface }]}>
        {/* AI Content Tools Row */}
        <View style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Sparkles size={16} color={palette.orange} />
            <AppText variant="bodySmallBold">AI Content Tools</AppText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            <Pressable onPress={handleAutoEnhance}>
              <Badge label="Auto-Enhance" tone="orange" />
            </Pressable>
          </ScrollView>
        </View>

        <View style={styles.toolGroups}>
          <Pressable onPress={handleFoodFilter} style={styles.toolItem}>
            <Wand2 size={24} color={palette.orange} />
            <AppText variant="micro" style={{ color: palette.orange }}>
              Filters
            </AppText>
          </Pressable>
          <Pressable onPress={handleLightAdjustment} style={styles.toolItem}>
            <Sun size={24} color={palette.text} />
            <AppText variant="micro">Light</AppText>
            <AppText variant="micro" tone="muted">
              {Math.round(adjustments.brightness * 100)}%
            </AppText>
          </Pressable>
          <Pressable onPress={handleColourAdjustment} style={styles.toolItem}>
            <Droplet size={24} color={palette.text} />
            <AppText variant="micro">Colour</AppText>
            <AppText variant="micro" tone="muted">
              {Math.round(adjustments.saturation * 100)}%
            </AppText>
          </Pressable>
        </View>

        <View style={{ gap: 4 }}>
          <AppText variant="micro" tone="muted">
            Brightness {Math.round(adjustments.brightness * 100)}% · Contrast{" "}
            {Math.round(adjustments.contrast * 100)}% · Saturation{" "}
            {Math.round(adjustments.saturation * 100)}%
          </AppText>
        </View>
      </View>

      {dialogConfig && (
        <Dialog
          visible={dialogConfig.visible}
          title={dialogConfig.title}
          message={dialogConfig.message}
          onClose={() => setDialogConfig(null)}
          buttons={[{ text: "OK", style: "default", onPress: () => setDialogConfig(null) }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  imageContainer: {
    flex: 1,
    position: "relative",
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  floatingTools: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    gap: 20,
  },
  toolGroups: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  toolItem: {
    alignItems: "center",
    gap: 6,
  },
});
