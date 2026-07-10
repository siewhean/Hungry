import { Pressable, StyleSheet, View } from "react-native";
import { Camera } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { useUIStore } from "@/store/useUIStore";
import { AccessibleImage, AppText, EmptyState } from "../ui";
import { confirmGalleryAccess, isGalleryPermissionGranted } from "@/lib/permissions/gallery";

interface PhotoPickerProps {
  photos: string[];
  maxPhotos?: number;
  onAddPhoto?: (uri: string) => void;
  onRemovePhoto?: (uri: string) => void;
  onPhotoError?: (uri: string) => void;
}

function loadImagePickerModule() {
  try {
    return require("expo-image-picker");
  } catch {
    return null;
  }
}

export function PhotoPicker({
  photos,
  maxPhotos = 5,
  onAddPhoto,
  onRemovePhoto,
  onPhotoError,
}: PhotoPickerProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const canAddPhoto = Boolean(onAddPhoto) && photos.length < maxPhotos;
  const handleAddPhoto = async () => {
    if (!onAddPhoto || !canAddPhoto) {
      return;
    }

    try {
      const imagePicker = loadImagePickerModule();
      if (!imagePicker) {
        showToast({
          message: "Photo picker is unavailable. Please reinstall the app build.",
          tone: "warning",
        });
        return;
      }

      const shouldRequestPermission = await confirmGalleryAccess({
        title: "Allow gallery access",
        message: "Hungry needs access to your gallery to let you attach photos from your device.",
        confirmLabel: "Allow",
        cancelLabel: "Not now",
      });

      if (!shouldRequestPermission) {
        return;
      }

      const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
      if (!isGalleryPermissionGranted(permission)) {
        showToast({ message: "Photos permission is required to attach images.", tone: "warning" });
        return;
      }

      const result = await imagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        mediaTypes: imagePicker.MediaTypeOptions.Images,
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
      <View style={styles.grid}>
        {photos.map((uri) => (
          <Pressable key={uri} onPress={() => onRemovePhoto?.(uri)} style={styles.photoWrap}>
            <AccessibleImage
              source={{ uri }}
              accessibilityLabel="Attached review photo"
              style={[styles.photo, { borderRadius: componentRadii.card }]}
              contentFit="cover"
            />
          </Pressable>
        ))}
        {canAddPhoto ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            onPress={handleAddPhoto}
            style={({ pressed }) => [
              styles.photoWrap,
              {
                alignItems: "center",
                backgroundColor: palette.bgMuted,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                borderStyle: "dashed",
                borderWidth: 1,
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Camera size={18} color={palette.textMuted} />
            <AppText variant="bodySmall" tone="secondary">
              Add photo
            </AppText>
          </Pressable>
        ) : null}
        {photos.length === 0 && !canAddPhoto ? (
          <EmptyState
            title="No photos yet"
            body="Add photos to your post when available."
            icon={<Camera size={36} color={palette.textMuted} />}
          />
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
