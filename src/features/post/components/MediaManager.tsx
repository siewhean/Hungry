import React, { useEffect, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, Dimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, Plus, Video } from "lucide-react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { AccessibleImage, AppText, IconButton, Dialog } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useComposerStore, MediaItem } from "../useComposerStore";
import { semanticSpacing } from "@/theme/tokens";
import { confirmGalleryAccess, isGalleryPermissionGranted } from "@/lib/permissions/gallery";

const { width } = Dimensions.get("window");

function ComposerVideoPreview({ uri }: { uri: string }) {
  const { palette } = useHungryTheme();
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.play();

    const replaySubscription = player.addListener("playToEnd", () => {
      player.currentTime = 0;
      player.play();
    });

    return () => replaySubscription.remove();
  }, [player]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={[styles.videoBadge, { backgroundColor: palette.mediaScrimSoft }]}>
        <Video size={12} color={palette.white} />
        <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
          Video
        </AppText>
      </View>
    </View>
  );
}

export function MediaManager() {
  const { componentRadii, palette, shadows } = useHungryTheme();
  const media = useComposerStore((state) => state.media);
  const addMedia = useComposerStore((state) => state.addMedia);
  const removeMedia = useComposerStore((state) => state.removeMedia);

  const [dialogConfig, setDialogConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
  } | null>(null);

  const handlePickMedia = async () => {
    try {
      const shouldRequestPermission = await confirmGalleryAccess({
        title: "Allow gallery access",
        message: "Hungry needs access to your photo library to add media to your post.",
        confirmLabel: "Allow",
        cancelLabel: "Not now",
      });

      if (!shouldRequestPermission) {
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!isGalleryPermissionGranted({ status })) {
        setDialogConfig({
          visible: true,
          title: "Permission Required",
          message: "Hungry needs access to your photo library to add media to your post.",
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 1,
        selectionLimit: 10,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets) {
        const newMedia: MediaItem[] = result.assets.map((asset) => ({
          id: asset.assetId || `media-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          uri: asset.uri,
          type: (asset.type === "video" ? "video" : "image") as "video" | "image",
          width: asset.width,
          height: asset.height,
        }));
        addMedia(newMedia);
      }
    } catch (error) {
      console.error("Error picking media:", error);
      setDialogConfig({
        visible: true,
        title: "Error",
        message: "Failed to pick media. Please try again.",
      });
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingVertical: semanticSpacing.componentGap, gap: semanticSpacing.componentGap },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: semanticSpacing.screenEdge,
          gap: semanticSpacing.componentGap,
        }}
      >
        {media.map((item) => (
          <View key={item.id} style={[styles.mediaWrapper, { borderRadius: componentRadii.card }]}>
            {item.type === "video" ? (
              <ComposerVideoPreview uri={item.uri} />
            ) : (
              <AccessibleImage
                source={{ uri: item.uri }}
                style={styles.media}
                contentFit="cover"
                decorative
              />
            )}
            <IconButton
              variant="surface"
              size={28}
              accessibilityLabel="Remove media"
              onPress={() => removeMedia(item.id)}
              style={styles.removeBtn}
              icon={
                <Plus size={14} color={palette.text} style={{ transform: [{ rotate: "45deg" }] }} />
              }
            />
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add media from gallery"
          onPress={handlePickMedia}
          testID="post-composer-add-media"
          style={[
            styles.addMediaBtn,
            {
              backgroundColor: palette.surfaceRaised,
              borderColor: palette.border,
              borderRadius: componentRadii.button,
            },
          ]}
        >
          <Camera size={24} color={palette.textMuted} />
          <AppText variant="micro" tone="muted" style={{ marginTop: semanticSpacing.textStack }}>
            Add Media
          </AppText>
        </Pressable>
      </ScrollView>

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
  container: {},
  mediaWrapper: {
    width: width * 0.55,
    height: width * 0.55,
    position: "relative",
    overflow: "hidden",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  removeBtn: {
    position: "absolute",
    zIndex: 2,
    top: 6,
    right: 6,
  },
  videoBadge: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    position: "absolute",
    top: 8,
  },
  addMediaBtn: {
    width: width * 0.25,
    height: width * 0.55,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
  },
});
