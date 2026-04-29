import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { X, MoreHorizontal } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, IconButton, Dialog } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface Props {
  onClose: () => void;
  title?: string;
}

export function ComposerHeader({ onClose, title = "New post" }: Props) {
  const { spacing, palette } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [dialogConfig, setDialogConfig] = useState<{ visible: boolean; title: string; message: string } | null>(null);

  return (
    <>
      <View
        style={{
          paddingTop: insets.top + spacing[1],
          paddingHorizontal: spacing[4],
          paddingBottom: spacing[1],
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: palette.bg,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
          <IconButton
            variant="ghost"
            size={36}
            accessibilityLabel="Close"
            onPress={onClose}
            icon={<X size={20} color={palette.text} />}
            style={{ marginLeft: -spacing[1] }}
          />
          <AppText variant="bodyBold" style={{ fontSize: 16 }}>{title}</AppText>
        </View>

        <IconButton
          variant="ghost"
          size={36}
          accessibilityLabel="More options"
          onPress={() => setDialogConfig({
            visible: true,
            title: "Options",
            message: "Discard post, Hide from feed, or Enable merchant mode.",
          })}
          icon={<MoreHorizontal size={20} color={palette.text} />}
          style={{ marginRight: -spacing[1] }}
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
    </>
  );
}
