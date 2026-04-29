import React, { useState } from "react";
import { View, StyleSheet, Dimensions, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { X, Check, Sun, Contrast, Droplet, Crop, RotateCcw, Wand2, Sparkles } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { AppText, IconButton, Button, Badge, Dialog } from "@/components/ui";
import { useHungryTheme } from "@/theme";

const { width, height } = Dimensions.get("window");

interface Props {
  mediaId: string | null;
  onClose: () => void;
}

export function MediaEditor({ mediaId, onClose }: Props) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const [dialogConfig, setDialogConfig] = useState<{ visible: boolean; title: string; message: string } | null>(null);

  if (!mediaId) return null;

  const handleAITool = (tool: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDialogConfig({
      visible: true,
      title: "AI Feature",
      message: `Applying ${tool} to your media...`,
    });
  };

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg, zIndex: 1100 }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 60 }]}>
        <IconButton variant="ghost" onPress={onClose} icon={<X size={24} color={palette.text} />} accessibilityLabel="Close" />
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
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&q=80" }} 
          style={styles.mainImage} 
          contentFit="contain" 
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable onPress={() => handleAITool("Auto-Enhance")}>
              <Badge label="Auto-Enhance" tone="orange" />
            </Pressable>
            <Pressable onPress={() => handleAITool("Smart Reframe")}>
              <Badge label="Smart Reframe" tone="neutral" />
            </Pressable>
            <Pressable onPress={() => handleAITool("Food Detect")}>
              <Badge label="Food Detect" tone="neutral" />
            </Pressable>
          </ScrollView>
        </View>

        <View style={styles.toolGroups}>
          <Pressable 
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={styles.toolItem}
          >
            <Crop size={24} color={palette.text} />
            <AppText variant="micro">Crop</AppText>
          </Pressable>
          <Pressable 
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDialogConfig({
                visible: true,
                title: "Filters",
                message: "Trending, Cinema, Foodie, Vintage.",
              });
            }}
            style={styles.toolItem}
          >
            <Wand2 size={24} color={palette.orange} />
            <AppText variant="micro" style={{ color: palette.orange }}>Filters</AppText>
          </Pressable>
          <Pressable 
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={styles.toolItem}
          >
            <Sun size={24} color={palette.text} />
            <AppText variant="micro">Light</AppText>
          </Pressable>
          <Pressable 
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={styles.toolItem}
          >
            <Droplet size={24} color={palette.text} />
            <AppText variant="micro">Colour</AppText>
          </Pressable>
          <Pressable 
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={styles.toolItem}
          >
            <RotateCcw size={24} color={palette.text} />
            <AppText variant="micro">Rotate</AppText>
          </Pressable>
        </View>

        {/* Adjust Slider Placeholder */}
        <View style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: "80%", height: 2, backgroundColor: palette.border, position: "relative" }}>
            <View style={{ position: "absolute", left: "60%", top: -8, width: 18, height: 18, borderRadius: 9, backgroundColor: palette.orange, borderWidth: 3, borderColor: palette.white }} />
          </View>
        </View>

        <Button 
          label="Apply AI Auto-Crop" 
          variant="secondary" 
          size="sm" 
          fullWidth 
          onPress={() => handleAITool("Auto-Crop")}
          style={{ marginTop: 0 }} 
        />
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
    backgroundColor: "#000",
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
