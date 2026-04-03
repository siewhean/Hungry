import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Camera } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText, Button, Card } from "../ui";

interface PhotoPickerProps {
  photos: string[];
  maxPhotos?: number;
  onAddPhoto?: () => void;
  onRemovePhoto?: (uri: string) => void;
}

export function PhotoPicker({ photos, maxPhotos = 5, onAddPhoto, onRemovePhoto }: PhotoPickerProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const canAddPhoto = Boolean(onAddPhoto) && photos.length < maxPhotos;

  return (
    <View style={{ gap: spacing[3] }}>
      <Button
        label={photos.length >= maxPhotos ? "Photo limit reached" : "Add photo"}
        onPress={onAddPhoto}
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
    backgroundColor: "#E5E7EB",
    height: 96,
    width: 96,
  },
});
