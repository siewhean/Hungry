import { useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";

import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";

export function formatDeletionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * When someone signs back in during the 30-day deletion grace period, ask
 * whether to keep the account (cancels the request) or continue deletion.
 * Signing in alone does not cancel it, so a failed check or cancel is retried
 * the next time the app comes to the foreground.
 */
export function useAccountDeletionGracePrompt(onContinueDeletion: () => void) {
  const isAuthReady = useSessionStore((state) => state.isAuthReady);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const userId = useSessionStore((state) => state.authenticatedUserId);
  const promptedFor = useRef<string | null>(null);
  const continueRef = useRef(onContinueDeletion);
  continueRef.current = onContinueDeletion;
  const [foregroundCount, setForegroundCount] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setForegroundCount((count) => count + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated) {
      promptedFor.current = null;
      return;
    }
    const key = userId ?? "current";
    if (promptedFor.current === key) return;
    promptedFor.current = key;

    let cancelled = false;
    let settled = false;
    const retryOnNextForeground = () => {
      if (promptedFor.current === key) promptedFor.current = null;
    };
    void getHungryService()
      .auth.getPendingAccountDeletion()
      .then((pending) => {
        settled = true;
        if (cancelled || !pending) return;
        Alert.alert(
          "Account scheduled for deletion",
          `Your Hungry account will be deleted on ${formatDeletionDate(pending.scheduledFor)}. Do you want to keep it?`,
          [
            {
              text: "Continue deletion",
              style: "destructive",
              onPress: () => {
                useSessionStore.getState().signOut();
                continueRef.current();
              },
            },
            {
              text: "Keep my account",
              onPress: () => {
                void getHungryService()
                  .auth.cancelAccountDeletion()
                  .then(() => {
                    useUIStore
                      .getState()
                      .showToast({ message: "Account deletion cancelled.", tone: "success" });
                  })
                  .catch(() => {
                    retryOnNextForeground();
                    Alert.alert(
                      "Could not cancel deletion",
                      "Your account is still scheduled for deletion. We'll ask again next time you open Hungry, or tap Keep my account in Settings.",
                    );
                  });
              },
            },
          ],
          // Android back/outside taps would otherwise dismiss without a choice.
          { cancelable: false },
        );
      })
      .catch(() => {
        settled = true;
        retryOnNextForeground();
      });

    return () => {
      cancelled = true;
      // A check cut short (re-run on foreground) must not count as prompted.
      if (!settled) retryOnNextForeground();
    };
  }, [foregroundCount, isAuthReady, isAuthenticated, userId]);
}
