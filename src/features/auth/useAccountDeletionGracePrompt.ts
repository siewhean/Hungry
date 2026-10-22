import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";

export function formatDeletionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "an unconfirmed date";
  return date.toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" });
}

type DeletionPromptStatus =
  | "idle"
  | "checking"
  | "lookup_failed"
  | "scheduled"
  | "cancelling"
  | "cancel_failed"
  | "cancelled"
  | "none";
/** Sign-in only checks status. Only a confirmed Keep my account action cancels. */
export function useAccountDeletionGracePrompt(onContinueDeletion: () => void) {
  const isAuthReady = useSessionStore((state) => state.isAuthReady);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const userId = useSessionStore((state) => state.authenticatedUserId);
  const promptedFor = useRef<string | null>(null);
  const continueRef = useRef(onContinueDeletion);
  const retryRef = useRef<() => void>(() => undefined);
  const [status, setStatus] = useState<DeletionPromptStatus>("idle");
  continueRef.current = onContinueDeletion;

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated) {
      promptedFor.current = null;
      setStatus("idle");
      return;
    }
    const key = userId ?? "current";
    if (promptedFor.current === key) return;
    let cancelled = false;
    let operationInFlight = false;
    const isCurrent = () =>
      !cancelled &&
      useSessionStore.getState().isAuthenticated &&
      useSessionStore.getState().authenticatedUserId === userId;
    const leave = () => {
      if (!isCurrent()) return;
      useSessionStore.getState().signOut();
      continueRef.current();
    };
    const retryAlert = (title: string, message: string) =>
      Alert.alert(
        title,
        message,
        [
          {
            text: "Retry status check",
            onPress: () => {
              void check();
            },
          },
          { text: "Sign out", onPress: leave },
        ],
        { cancelable: false },
      );
    const check = async () => {
      if (operationInFlight || !isCurrent()) return;
      operationInFlight = true;
      setStatus("checking");
      try {
        const pending = await getHungryService().auth.getPendingAccountDeletion();
        if (!isCurrent()) return;
        // Mark checked only after a confirmed response; failures retain a retry path.
        promptedFor.current = key;
        if (!pending) {
          setStatus("none");
          return;
        }
        setStatus("scheduled");
        Alert.alert(
          "Account scheduled for deletion",
          `Your Hungry account is scheduled for deletion on ${formatDeletionDate(pending.scheduledFor)}. Signing in does not cancel deletion.`,
          [
            { text: "Continue deletion", style: "destructive", onPress: leave },
            {
              text: "Keep my account",
              onPress: () => {
                if (operationInFlight || !isCurrent()) return;
                operationInFlight = true;
                setStatus("cancelling");
                void getHungryService()
                  .auth.cancelAccountDeletion()
                  .then((confirmed) => {
                    if (!isCurrent()) return;
                    if (!confirmed)
                      throw new Error(
                        "Cancellation was not confirmed. The request may already be processing.",
                      );
                    setStatus("cancelled");
                    useUIStore
                      .getState()
                      .showToast({ message: "Account deletion cancelled.", tone: "success" });
                  })
                  .catch(() => {
                    if (!isCurrent()) return;
                    setStatus("cancel_failed");
                    retryAlert(
                      "Deletion cancellation not confirmed",
                      "Your account may still be scheduled for deletion. Retry the status check and choose Keep my account again, or contact support before the deletion date.",
                    );
                  })
                  .finally(() => {
                    operationInFlight = false;
                  });
              },
            },
          ],
          { cancelable: false },
        );
      } catch {
        if (!isCurrent()) return;
        setStatus("lookup_failed");
        retryAlert(
          "Could not check deletion status",
          "Your deletion status is unknown. Signing in does not cancel an existing request. Retry to confirm your account's status.",
        );
      } finally {
        operationInFlight = false;
      }
    };
    retryRef.current = () => {
      void check();
    };
    void check();
    return () => {
      cancelled = true;
      retryRef.current = () => undefined;
    };
  }, [isAuthReady, isAuthenticated, userId]);
  return { status, retry: () => retryRef.current() };
}
