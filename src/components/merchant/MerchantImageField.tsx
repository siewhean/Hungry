import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AccessibleImage, AppText, Button } from "@/components/ui";
import { confirmGalleryAccess, isGalleryPermissionGranted } from "@/lib/permissions/gallery";
import { useHungryTheme } from "@/theme";

function loadImagePickerModule() {
  try {
    return require("expo-image-picker");
  } catch {
    return null;
  }
}

export function MerchantImageField({
  label,
  value,
  onChange,
  isSaving,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isSaving: boolean;
  icon: React.ReactNode;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [error, setError] = useState<string | null>(null);

  const handlePick = async () => {
    try {
      setError(null);
      const imagePicker = loadImagePickerModule();
      if (!imagePicker) {
        setError("Photo picker is unavailable in this build.");
        return;
      }

      const shouldRequestPermission = await confirmGalleryAccess({
        title: "Allow gallery access",
        message:
          "Hungry needs access to your photo library to upload your profile image for the outlet.",
        confirmLabel: "Allow",
        cancelLabel: "Not now",
      });

      if (!shouldRequestPermission) {
        return;
      }

      const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
      if (!isGalleryPermissionGranted(permission)) {
        setError("Photos permission is required to upload this image.");
        return;
      }
      const result = await imagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        mediaTypes: imagePicker.MediaTypeOptions.Images,
        quality: 0.82,
        selectionLimit: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      onChange(result.assets[0].uri);
    } catch {
      setError("Unable to open the photo library right now.");
    }
  };

  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="bodyBold">{label}</AppText>
      {value.trim() ? (
        <AccessibleImage
          source={{ uri: value.trim() }}
          style={[
            styles.photoPreview,
            { borderRadius: componentRadii.input, borderColor: palette.border },
          ]}
          accessibilityLabel={`${label} preview`}
        />
      ) : (
        <View
          accessibilityLabel={`${label} preview`}
          style={[
            styles.photoPlaceholder,
            {
              backgroundColor: palette.bgSoft,
              borderColor: palette.border,
              borderRadius: componentRadii.input,
            },
          ]}
        >
          {icon}
          <AppText variant="micro" tone="muted" style={{ marginTop: 4 }}>
            Upload from your phone or gallery.
          </AppText>
        </View>
      )}
      {isSaving && value ? (
        <AppText variant="micro" tone="muted">
          Uploading and saving image...
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="micro" style={{ color: palette.error }}>
          {error}
        </AppText>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        <Button label={value ? "Replace" : "Upload"} variant="secondary" onPress={handlePick} />
        {value ? <Button label="Remove" variant="ghost" onPress={() => onChange("")} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  photoPreview: {
    width: "100%",
    height: 140,
    borderWidth: 1,
  },
  photoPlaceholder: {
    height: 140,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
});
