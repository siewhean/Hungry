import { useState } from "react";
import { Pressable, StyleSheet, View, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Camera, Video, Edit2, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import { useHungryTheme } from "@/theme";
import { useUIStore } from "@/store/useUIStore";
import { AppText, Card } from "../ui";
import { MediaEditor } from "./MediaEditor";

interface MediaPickerProps {
  photos: string[];
  videoUri?: string;
  filterId?: string;
  maxPhotos?: number;
  onAddPhoto: (uri: string) => void;
  onRemovePhoto: (uri: string) => void;
  onSetVideo: (uri?: string) => void;
  onSetFilter: (filterId: string) => void;
}

export function MediaPicker({
  photos,
  videoUri,
  filterId,
  maxPhotos = 5,
  onAddPhoto,
  onRemovePhoto,
  onSetVideo,
  onSetFilter,
}: MediaPickerProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const [editingUri, setEditingUri] = useState<string | null>(null);

  const handlePickMedia = async (type: "image" | "video") => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
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

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (type === "video") {
      onSetVideo(asset.uri);
    } else {
      onAddPhoto(asset.uri);
    }
    // Automatically open editor for the new media
    setEditingUri(asset.uri);
  };

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <AppText variant="h3">Photos & Reels</AppText>
        <AppText variant="micro" tone="muted">
          {photos.length}/5 photos
        </AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[3] }}
      >
        {/* Video/Reel Slot */}
        {videoUri ? (
          <View style={styles.mediaContainer}>
            <Image
              source={{ uri: videoUri }}
              style={[styles.media, { borderRadius: radii.md }]}
              contentFit="cover"
            />
            <View style={styles.badge}>
              <Video size={12} color={palette.white} />
            </View>
            <View style={styles.mediaActions}>
              <Pressable onPress={() => setEditingUri(videoUri)} style={styles.actionBtn}>
                <Edit2 size={14} color={palette.white} />
              </Pressable>
              <Pressable
                onPress={() => onSetVideo(undefined)}
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
            <Image
              source={{ uri }}
              style={[styles.media, { borderRadius: radii.md }]}
              contentFit="cover"
            />
            <View style={styles.mediaActions}>
              <Pressable onPress={() => setEditingUri(uri)} style={styles.actionBtn}>
                <Edit2 size={14} color={palette.white} />
              </Pressable>
              <Pressable
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

      {editingUri && (
        <MediaEditor
          uri={editingUri}
          isVisible={!!editingUri}
          initialFilterId={filterId}
          onClose={() => setEditingUri(null)}
          onSave={(fid) => {
            onSetFilter(fid);
            setEditingUri(null);
            showToast({ message: "Filter applied!", tone: "success" });
          }}
        />
      )}
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
    backgroundColor: "#000",
  },
  pickerBtn: {
    width: 120,
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
