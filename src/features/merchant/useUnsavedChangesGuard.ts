import { useCallback } from "react";
import { Alert, BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

/**
 * Asks "Discard changes?" before leaving an editor with unsaved edits. Returns the handler for the
 * header back button; Android's hardware back is intercepted while the editor is focused.
 * (Merchant editors are hidden tabs, so React Navigation's beforeRemove never fires for them.)
 */
export function useUnsavedChangesGuard(isDirty: boolean, leave: () => void): () => void {
  const confirmLeave = useCallback(() => {
    if (!isDirty) {
      leave();
      return;
    }
    Alert.alert("Discard changes?", "You have unsaved changes. Leave without saving them?", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: leave },
    ]);
  }, [isDirty, leave]);

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
