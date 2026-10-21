import { Pressable, StyleSheet, View, ScrollView } from "react-native";
import { Camera, Video, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import { useHungryTheme } from "@/theme";
import { componentRadii } from "@/theme/tokens";
import { useUIStore } from "@/store/useUIStore";
import { AccessibleImage, AppText, Card } from "../ui";
import { askMediaSource, captureWithCamera } from "@/lib/permissions/mediaSource";

interface MediaPickerProps {
  photos: string[];
  videoUri?: string;
  maxPhotos?: number;
  onAddPhoto: (uri: string) => void;
  onRemovePhoto: (uri: string) => void;
  /** Omit to hide the reel slot. */
  onSetVideo?: (uri?: string) => void;
}

export function MediaPicker({
  photos,
  videoUri,
  maxPhotos = 5,
  onAddPhoto,
  onRemovePhoto,
  onSetVideo,
}: MediaPickerProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);

  const handlePickMedia = async (type: "image" | "video") => {
    const remainingPhotos = Math.max(0, maxPhotos - photos.length);
    if (type === "image" && remainingPhotos === 0) return;

    if (type === "image") {
      const source = await askMediaSource();
      if (!source) return;
      if (source === "camera") {
        const capture = await captureWithCamera({ mediaTypes: ["images"], quality: 0.8 });
        if (capture.status === "denied") {
          showToast({ message: "Camera permission is required to take a photo.", tone: "warning" });
        } else if (capture.status === "ok" && capture.assets[0]?.uri) {
          onAddPhoto(capture.assets[0].uri);
        }
        return;
      }
    }

    // The system photo picker needs no library permission; it only returns what is picked.
    // Photos are picked several at a time (no editor round trip per photo);
    // a reel is still one clip with the trim editor.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === "image" ? ["images"] : ["videos"],
      allowsEditing: type === "video",
      allowsMultipleSelection: type === "image",
      selectionLimit: type === "image" ? remainingPhotos : 1,
      orderedSelection: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets?.length) return;

    if (type === "video") {
      onSetVideo?.(result.assets[0]?.uri);
      return;
    }
    const pickedUris = result.assets
      .map((asset) => asset.uri)
      .filter((uri, index, uris) => uri && !photos.includes(uri) && uris.indexOf(uri) === index)
      .slice(0, remainingPhotos);
    pickedUris.forEach(onAddPhoto);
    if (pickedUris.length < result.assets.length) {
      showToast({
        message: `Up to ${maxPhotos} photos, each added once.`,
        tone: "info",
      });
    }
  };

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <AppText variant="h3">{onSetVideo ? "Photos & Reels" : "Photos"}</AppText>
        <AppText variant="micro" tone="muted">
          {photos.length}/{maxPhotos} photos
        </AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[3] }}
      >
        {/* Video/Reel Slot */}
        {!onSetVideo ? null : videoUri ? (
          <View style={styles.mediaContainer}>
            <AccessibleImage
              source={{ uri: videoUri }}
              accessibilityLabel="Selected review reel"
              style={[
                styles.media,
                { backgroundColor: palette.mediaBackdrop, borderRadius: componentRadii.card },
              ]}
              contentFit="cover"
            />
            <View style={[styles.badge, { backgroundColor: palette.mediaScrim }]}>
              <Video size={12} color={palette.white} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove reel"
              onPress={() => onSetVideo?.(undefined)}
              style={[styles.actionBtn, styles.removeAction, { backgroundColor: palette.error }]}
            >
              <X size={16} color={palette.white} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a reel"
            onPress={() => handlePickMedia("video")}
            style={({ pressed }) => [
              styles.pickerBtn,
              {
                borderColor: palette.orange,
                borderStyle: "dashed",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Video size={24} color={palette.orange} />
            <AppText variant="micro" style={{ color: palette.orange }}>
              Add Reel
            </AppText>
          </Pressable>
        )}

        {/* Photos */}
        {photos.map((uri, index) => (
          <View key={uri} style={styles.mediaContainer}>
            <AccessibleImage
              source={{ uri }}
              accessibilityLabel={`Review photo ${index + 1} of ${photos.length}`}
              style={[
                styles.media,
                { backgroundColor: palette.mediaBackdrop, borderRadius: componentRadii.card },
              ]}
              contentFit="cover"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              onPress={() => onRemovePhoto(uri)}
              style={[styles.actionBtn, styles.removeAction, { backgroundColor: palette.error }]}
            >
              <X size={16} color={palette.white} />
            </Pressable>
          </View>
        ))}

        {photos.length < maxPhotos && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add a photo, ${photos.length} of ${maxPhotos} added`}
            onPress={() => handlePickMedia("image")}
            style={({ pressed }) => [
              styles.pickerBtn,
              {
                borderColor: palette.border,
                borderStyle: "dashed",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Camera size={24} color={palette.textMuted} />
            <AppText variant="micro" tone="secondary">
              Add Photo
            </AppText>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mediaContainer: {
    width: 120,
    height: 160,
    position: "relative",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  pickerBtn: {
    width: 120,
    height: 160,
    borderRadius: componentRadii.card,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    padding: 4,
    borderRadius: 4,
  },
  // 44pt touch targets.
  actionBtn: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  removeAction: {
    top: 4,
    right: 4,
  },
});
