import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { usePreventRemove, type NavigationAction } from "@react-navigation/native";

/** Native-stack back buttons and gestures must use React Navigation's removal guard. */
export function useDraftExitGuard(input: {
  dirty: boolean;
  title: string;
  discard: () => void;
  dispatch: (action: NavigationAction) => void;
}) {
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState<NavigationAction | null>(null);
  const proceed = (action: NavigationAction) => {
    setAllowed(true);
    setPending(action);
  };
  usePreventRemove(input.dirty && !allowed, ({ data }) => {
    Alert.alert(input.title, "Save your draft to continue later, or discard it.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Save draft", onPress: () => proceed(data.action) },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          input.discard();
          proceed(data.action);
        },
      },
    ]);
  });
  useEffect(() => {
    if (!allowed || !pending) return;
    setPending(null);
    input.dispatch(pending);
    // A no-op pop or a retained editor must protect the next draft again.
    setAllowed(false);
  }, [allowed, pending, input.dispatch]);
  return proceed;
}
