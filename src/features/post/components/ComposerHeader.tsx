import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { X, MoreHorizontal } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader, IconButton, Dialog } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface Props {
  onClose: () => void;
  title?: string;
}

export function ComposerHeader({ onClose, title = "New post" }: Props) {
  const { spacing, palette } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [dialogConfig, setDialogConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
  } | null>(null);

  return (
    <>
      <View
        style={{
          paddingTop: insets.top + spacing[1],
          backgroundColor: palette.bg,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        }}
      >
        <AppHeader
          title={title}
          horizontalPadding={spacing[3]}
          left={
            <IconButton
              variant="ghost"
              size={36}
              accessibilityLabel="Close"
              onPress={onClose}
              icon={<X size={20} color={palette.text} />}
            />
          }
          right={
            <IconButton
              variant="ghost"
              size={36}
              accessibilityLabel="More options"
              onPress={() =>
                setDialogConfig({
                  visible: true,
                  title: "Options",
                  message: "Discard post, Hide from feed, or Enable merchant mode.",
                })
              }
              icon={<MoreHorizontal size={20} color={palette.text} />}
            />
          }
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
