import React from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { useHungryTheme } from "@/theme";

interface DialogButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: DialogButton[];
  onClose: () => void;
}

export function Dialog({ visible, title, message, buttons, onClose }: DialogProps) {
  const { palette, radii, spacing, shadows } = useHungryTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[
          styles.container, 
          { 
            backgroundColor: palette.surface, 
            borderRadius: radii.xl,
            padding: spacing[6],
            ...shadows.floating
          }
        ]}>
          <AppText variant="h3" style={{ marginBottom: spacing[2] }}>{title}</AppText>
          {message ? (
            <AppText variant="bodySmall" tone="secondary" style={{ marginBottom: spacing[6] }}>
              {message}
            </AppText>
          ) : null}
          
          <View style={{ gap: spacing[3] }}>
            {buttons.map((btn, index) => (
              <Button
                key={index}
                label={btn.text}
                variant={btn.style === "destructive" ? "primary" : btn.style === "cancel" ? "ghost" : "secondary"}
                onPress={() => {
                  btn.onPress?.();
                  onClose();
                }}
                style={btn.style === "destructive" ? { backgroundColor: palette.error } : undefined}
                fullWidth
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  container: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
});
