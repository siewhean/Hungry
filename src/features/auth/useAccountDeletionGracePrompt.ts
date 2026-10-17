import { useEffect, useRef } from "react";
import { Alert } from "react-native";

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
 */
export function useAccountDeletionGracePrompt(onContinueDeletion: () => void) {
  const isAuthReady = useSessionStore((state) => state.isAuthReady);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const userId = useSessionStore((state) => state.authenticatedUserId);
  const promptedFor = useRef<string | null>(null);
  const continueRef = useRef(onContinueDeletion);
  continueRef.current = onContinueDeletion;

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated) {
      promptedFor.current = null;
      return;
    }
    const key = userId ?? "current";
    if (promptedFor.current === key) return;
    promptedFor.current = key;

    let cancelled = false;
    void getHungryService()
      .auth.getPendingAccountDeletion()
      .then((pending) => {
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
                    Alert.alert(
                      "Could not cancel deletion",
                      "Please try again or contact support before the deletion date.",
                    );
                  });
              },
            },
          ],
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, isAuthenticated, userId]);
}
