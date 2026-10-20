import type { ReactNode } from "react";
import { Alert, Share, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Info } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";

// Raw error text and the "Send error" share action are debugging aids for internal
// builds. Production users only see the friendly title/body.
const showDebugErrorDetails =
  (typeof __DEV__ !== "undefined" && __DEV__) ||
  (process.env.EXPO_PUBLIC_APP_ENV !== undefined &&
    process.env.EXPO_PUBLIC_APP_ENV !== "production");

interface EmptyStateProps {
  title: string;
  body: string;
  icon?: ReactNode;
  ctaLabel?: string;
  onPress?: () => void;
  errorMessage?: string;
  sendErrorLabel?: string;
  sendErrorContext?: string;
  onSendError?: () => void;
}

export function EmptyState({
  title,
  body,
  icon,
  ctaLabel,
  onPress,
  errorMessage,
  sendErrorLabel,
  sendErrorContext,
  onSendError,
}: EmptyStateProps) {
  const { spacing, palette } = useHungryTheme();
  const renderIcon = icon ?? <Info size={34} color={palette.textSecondary} />;
  const reportContext = sendErrorContext ?? "Hungry screen";
  const resolvedOnSendError = !showDebugErrorDetails
    ? undefined
    : onSendError
      ? onSendError
      : errorMessage
        ? async () => {
            const payload = `${reportContext}\n${title}\n${errorMessage}`;
            try {
              await Clipboard.setStringAsync(payload);
            } catch {}
            try {
              await Share.share({ message: payload, title: "Hungry App Error Report" });
            } catch {
              Alert.alert(
                "Error report",
                "Unable to open sharing options. Error text copied to clipboard.",
              );
            }
          }
        : undefined;

  return (
    <View
      style={{
        alignItems: "center",
        gap: spacing[2],
        padding: spacing[4],
      }}
    >
      <View style={{ alignItems: "center", justifyContent: "center", opacity: 0.9 }}>
        {renderIcon}
      </View>
      <AppText variant="h3" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      <AppText tone="secondary" style={{ textAlign: "center" }}>
        {body}
      </AppText>
      {showDebugErrorDetails && errorMessage ? (
        <AppText tone="muted" variant="bodySmall" style={{ textAlign: "center" }}>
          {errorMessage}
        </AppText>
      ) : null}
      {ctaLabel ? <Button label={ctaLabel} onPress={onPress} /> : null}
      {resolvedOnSendError ? (
        <Button
          label={sendErrorLabel ?? "Send error"}
          variant="secondary"
          onPress={resolvedOnSendError}
        />
      ) : null}
    </View>
  );
}
