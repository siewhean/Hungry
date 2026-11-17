import { getAccountGeneration } from "@/lib/security/accountScope";
import { useState } from "react";
import { Pressable, StyleSheet, View, ScrollView } from "react-native";
import { Camera, Video, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import { useHungryTheme } from "@/theme";
import { componentRadii } from "@/theme/tokens";
import { useUIStore } from "@/store/useUIStore";
import { AccessibleImage, AppText, Card } from "../ui";

import { confirmGalleryAccess, isGalleryPermissionGranted } from "@/lib/permissions/gallery";

interface MediaPickerProps {
  photos: string[];
  videoUri?: string;
  filterId?: string;
  maxPhotos?: number;
  onAddPhoto: (uri: string) => void;
  onRemovePhoto: (uri: string) => void;
  /** Omit to hide the reel slot. */
  onSetVideo?: (uri?: string) => void;
  onSetFilter: (filterId: string) => void;
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
  const [isPicking, setIsPicking] = useState(false);

  const handlePickMedia = async (type: "image" | "video") => {
    if (isPicking) return;
    setIsPicking(true);
    const generation = getAccountGeneration();
    try {
      const shouldOpenPicker = await confirmGalleryAccess({
        title: "Allow gallery access",
        message:
          "Hungry needs access to your photo and video library to attach media to your review.",
        confirmLabel: "Allow",
        cancelLabel: "Not now",
      });

      if (generation !== getAccountGeneration()) return;
      if (!shouldOpenPicker) {
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (generation !== getAccountGeneration()) return;
      if (!isGalleryPermissionGranted(permission)) {
        showToast({ message: "Gallery permission is required.", tone: "warning" });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          type === "image"
            ? ImagePicker.MediaTypeOptions.Images
            : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (generation !== getAccountGeneration()) return;
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      if (type === "video") {
        onSetVideo?.(asset.uri);
      } else {
        onAddPhoto(asset.uri);
      }
    } catch {
      if (generation !== getAccountGeneration()) return;
      showToast({ message: "Could not open the media picker. Try again.", tone: "warning" });
    } finally {
      setIsPicking(false);
    }
  };

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <AppText variant="h3">Photos</AppText>
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
            <View style={styles.mediaActions}>
              <Pressable
                onPress={() => onSetVideo?.(undefined)}
                style={[styles.actionBtn, { backgroundColor: palette.error }]}
              >
                <X size={14} color={palette.white} />
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
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
        {photos.map((uri) => (
          <View key={uri} style={styles.mediaContainer}>
            <AccessibleImage
              source={{ uri }}
              accessibilityLabel="Selected review photo"
              style={[
                styles.media,
                { backgroundColor: palette.mediaBackdrop, borderRadius: componentRadii.card },
              ]}
              contentFit="cover"
            />
            <View style={styles.mediaActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${photos.indexOf(uri) + 1}`}
                onPress={() => onRemovePhoto(uri)}
                style={[styles.actionBtn, { backgroundColor: palette.error }]}
              >
                <X size={14} color={palette.white} />
              </Pressable>
            </View>
          </View>
        ))}

        {photos.length < maxPhotos && (
          <Pressable
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
  mediaActions: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    gap: 4,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: componentRadii.card,
    alignItems: "center",
    justifyContent: "center",
  },
});
