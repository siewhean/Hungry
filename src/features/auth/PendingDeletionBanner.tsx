import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

import { AppText, Button, Card } from "@/components/ui";
import { SUPPORT_EMAIL } from "@/constants/links";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { explainNothingCancelled, formatDeletionDate } from "./useAccountDeletionGracePrompt";

/**
 * Signing in does not cancel a deletion request; only Keep my account does. While a
 * request is pending this stays on Profile and Settings, so a missed or failed
 * sign-in prompt still leaves a way to keep the account.
 */
export function PendingDeletionBanner({
  onPendingChange,
}: {
  /** Told whether a deletion request is pending (Settings hides Delete account then). */
  onPendingChange?: (pending: boolean) => void;
} = {}) {
  const { spacing } = useHungryTheme();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [isKeeping, setIsKeeping] = useState(false);

  useEffect(() => {
    onPendingChange?.(scheduledFor !== null);
  }, [onPendingChange, scheduledFor]);

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
        .catch((error: unknown) => reportError(error, { area: "pending_deletion_banner_load" }));
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
      .then(async (cancelled) => {
        if (!cancelled) {
          // Nothing was cancelled: the deletion already started, or was already stopped.
          const pending = await explainNothingCancelled();
          setScheduledFor(pending?.scheduledFor ?? null);
          return;
        }
        trackAnalyticsEvent("account_deletion_cancelled", { surface: "banner" });
        setScheduledFor(null);
        useUIStore
          .getState()
          .showToast({ message: "Account deletion cancelled.", tone: "success" });
      })
      .catch((error: unknown) => {
        reportError(error, { area: "pending_deletion_banner_cancel" });
        Alert.alert(
          "Could not cancel deletion",
          `Please try again, or email ${SUPPORT_EMAIL} before the deletion date.`,
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
