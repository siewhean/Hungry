import { View } from "react-native";

import { AppText, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { AUTH_COPY } from "./authCopy";

/** Shown while a signed-in account's taste profile could not be loaded; Try again re-runs it. */
export function ProfileSyncFailureBanner({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: palette.errorSoft,
        borderRadius: componentRadii.card,
        gap: spacing[2],
        padding: spacing[3],
      }}
    >
      <AppText variant="bodySmall" style={{ color: palette.error }}>
        {AUTH_COPY.emailCode.syncFailed}
      </AppText>
      <Button
        label={AUTH_COPY.emailCode.syncRetry}
        variant="secondary"
        onPress={onRetry}
        loading={retrying}
      />
    </View>
  );
}
