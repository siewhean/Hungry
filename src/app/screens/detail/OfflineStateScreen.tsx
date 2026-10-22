import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import NetInfo from "@react-native-community/netinfo";
import { useUIStore } from "@/store/useUIStore";
import { Button, EmptyState, Screen } from "@/components/ui";
import { isNetworkOffline } from "@/lib/network/connectivity";

export function OfflineStateScreen() {
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const setOffline = useUIStore((state) => state.setOffline);
  const retryConnection = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const state = await NetInfo.refresh();
      const offline = isNetworkOffline(state);
      setOffline(offline);
      if (!offline && navigation.canGoBack()) navigation.goBack();
      else if (offline) setError("Still offline. Try again when your connection returns.");
    } catch {
      setError("Connection check failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Offline mode">
      <EmptyState
        title="You're offline"
        body={
          error ??
          "Previously loaded content may remain available. Reconnect before submitting changes."
        }
      />
      <Button
        label={busy ? "Checking connection…" : "Retry connection"}
        disabled={busy}
        onPress={() => void retryConnection()}
      />
    </Screen>
  );
}
