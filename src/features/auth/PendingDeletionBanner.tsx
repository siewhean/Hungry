import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { AppText, Button, Card } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { formatDeletionDate } from "./useAccountDeletionGracePrompt";

/**
 * Signing in does not cancel a deletion request; only Keep my account does. While a
 * request is pending this stays on Profile and Settings, so a missed or failed
 * sign-in prompt still leaves a way to keep the account.
 */
export function PendingDeletionBanner() {
  const { spacing } = useHungryTheme();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [isKeeping, setIsKeeping] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        setScheduledFor(null);
        return undefined;
      }
      let active = true;
      void getHungryService()
        .auth.getPendingAccountDeletion()
        .then((pending) => {
          if (active) setScheduledFor(pending?.scheduledFor ?? null);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [isAuthenticated]),
  );

  if (!scheduledFor) return null;

  const keepAccount = () => {
    setIsKeeping(true);
    void getHungryService()
      .auth.cancelAccountDeletion()
      .then(() => {
        setScheduledFor(null);
        useUIStore
          .getState()
          .showToast({ message: "Account deletion cancelled.", tone: "success" });
      })
      .catch(() => {
        Alert.alert(
          "Could not cancel deletion",
          "Please try again, or email usehungrysingapore@gmail.com before the deletion date.",
        );
      })
      .finally(() => setIsKeeping(false));
  };

  return (
    <Card style={{ gap: spacing[2], marginBottom: spacing[3] }}>
      <AppText variant="bodyBold" accessibilityRole="header">
        {`Deletion scheduled for ${formatDeletionDate(scheduledFor)}`}
      </AppText>
      <AppText variant="bodySmall" tone="secondary">
        Your account and data will be deleted on that date unless you keep it.
      </AppText>
      <Button
        label="Keep my account"
        variant="primary"
        fullWidth={false}
        loading={isKeeping}
        disabled={isKeeping}
        onPress={keepAccount}
      />
    </Card>
  );
}
