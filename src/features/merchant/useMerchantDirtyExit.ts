import { useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  CommonActions,
  useNavigation,
  useIsFocused,
  usePreventRemove,
  type NavigationAction,
} from "@react-navigation/native";

export function useMerchantDirtyExit(isDirty: boolean, isSaving = false) {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const [pending, setPending] = useState<NavigationAction | null>(null);
  useEffect(() => {
    if (!focused) setPending(null);
  }, [focused]);
  usePreventRemove(isDirty && !pending, ({ data }) => {
    if (isSaving) {
      Alert.alert("Save in progress", "Wait for the save result before leaving.");
      return;
    }
    Alert.alert("Discard changes?", "Your unsaved changes will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => setPending(data.action) },
    ]);
  });
  useEffect(() => {
    if (pending) navigation.dispatch(pending);
  }, [navigation, pending]);
  return () => setPending(CommonActions.goBack());
}
