import { Alert, Platform } from "react-native";

/**
 * A two-button confirm that also works on web, where react-native-web's Alert.alert does
 * nothing (so a confirm behind it would make the button a no-op). Native shows the Alert.
 */
export function confirmAction(options: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  if (Platform.OS === "web") {
    const confirm = (globalThis as { confirm?: (message: string) => boolean }).confirm;
    // No dialog available (a test or embedded view): act, as the button asked.
    if (!confirm || confirm(`${options.title}\n\n${options.message}`)) options.onConfirm();
    return;
  }
  Alert.alert(options.title, options.message, [
    { text: "Cancel", style: "cancel" },
    {
      text: options.confirmLabel,
      style: options.destructive ? "destructive" : "default",
      onPress: options.onConfirm,
    },
  ]);
}
