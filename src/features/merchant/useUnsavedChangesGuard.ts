import { useCallback } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import type { ShowMerchantAlert } from "./useMerchantDialog";

/**
 * Asks "Discard changes?" before leaving an editor with unsaved edits. Returns the handler for the
 * header back button; Android's hardware back is intercepted while the editor is focused.
 * The prompt is the shared dialog (from `useMerchantDialog`) because Alert does nothing on web.
 * (Merchant editors are hidden tabs, so React Navigation's beforeRemove never fires for them.)
 */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  leave: () => void,
  showAlert: ShowMerchantAlert,
): () => void {
  const confirmLeave = useCallback(() => {
    if (!isDirty) {
      leave();
      return;
    }
    showAlert("Discard changes?", "You have unsaved changes. Leave without saving them?", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: leave },
    ]);
  }, [isDirty, leave, showAlert]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!isDirty) return false;
        confirmLeave();
        return true;
      });
      return () => subscription.remove();
    }, [confirmLeave, isDirty]),
  );

  return confirmLeave;
}
