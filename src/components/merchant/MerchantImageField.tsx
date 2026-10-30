import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { AccessibleImage, AppText, Button } from "@/components/ui";
import {
  pickMerchantMedia,
  type MerchantMediaSource,
} from "@/features/merchant/merchantMediaPicker";
import { useHungryTheme } from "@/theme";

export function MerchantImageField({
  label,
  value,
  onChange,
  isSaving,
  icon,
  rationale,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isSaving: boolean;
  icon: React.ReactNode;
  /** Why Hungry needs the photo library for this image, shown before the permission prompt. */
  rationale?: string;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (source: MerchantMediaSource) => {
    try {
      setError(null);
      const uri = await pickMerchantMedia({
        kind: "image",
        source,
        rationale:
          rationale ??
          `Hungry needs access to your photo library to upload the ${label.toLowerCase()} for your outlet.`,
      });
      if (uri) onChange(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open the photo library right now.");
    }
  };

  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="bodyBold">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          value.trim() ? `Replace ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`
        }
        onPress={() => void handlePick("library")}
      >
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
              Tap to choose from your phone or gallery.
            </AppText>
          </View>
        )}
      </Pressable>
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
        {Platform.OS !== "web" ? (
          <Button
            label="Take photo"
            variant="secondary"
            onPress={() => void handlePick("camera")}
          />
        ) : null}
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
