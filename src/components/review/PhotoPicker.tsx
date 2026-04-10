import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Camera } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import { useHungryTheme } from "@/theme";
import { useUIStore } from "@/store/useUIStore";
import { AppText, Button, Card } from "../ui";

interface PhotoPickerProps {
  photos: string[];
  maxPhotos?: number;
  onAddPhoto?: (uri: string) => void;
  onRemovePhoto?: (uri: string) => void;
  onPhotoError?: (uri: string) => void;
}

export function PhotoPicker({
  photos,
  maxPhotos = 5,
  onAddPhoto,
  onRemovePhoto,
  onPhotoError,
}: PhotoPickerProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const canAddPhoto = Boolean(onAddPhoto) && photos.length < maxPhotos;
  const handleAddPhoto = async () => {
    if (!onAddPhoto || !canAddPhoto) {
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast({ message: "Photos permission is required to attach images.", tone: "warning" });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        mediaTypes: ["images"],
        quality: 0.82,
        selectionLimit: 1,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const pickedUri = result.assets[0].uri;
      onAddPhoto(pickedUri);
    } catch {
      const failedUri = `picker-failure-${Date.now()}`;
      onPhotoError?.(failedUri);
      showToast({ message: "Unable to open photo library right now.", tone: "warning" });
    }
  };

  return (
    <View style={{ gap: spacing[3] }}>
      <Button
        label={photos.length >= maxPhotos ? "Photo limit reached" : "Add photo"}
        onPress={handleAddPhoto}
        disabled={!canAddPhoto}
      />
      <View style={styles.grid}>
        {photos.map((uri) => (
          <Pressable key={uri} onPress={() => onRemovePhoto?.(uri)} style={styles.photoWrap}>
            <Image source={{ uri }} style={[styles.photo, { borderRadius: radii.sm }]} contentFit="cover" />
          </Pressable>
        ))}
        {photos.length === 0 ? (
          <Card style={{ alignItems: "center", backgroundColor: palette.bgMuted, borderStyle: "dashed", gap: 8 }}>
            <Camera size={18} color={palette.textMuted} />
            <AppText variant="bodySmall" tone="secondary">
              No photos yet
            </AppText>
          </Card>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoWrap: {
    minHeight: 96,
    minWidth: 96,
  },
  photo: {
    backgroundColor: "transparent",
    height: 96,
    width: 96,
  },
});
