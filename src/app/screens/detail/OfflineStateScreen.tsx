import NetInfo from "@react-native-community/netinfo";
import { useUIStore } from "@/store/useUIStore";
import { Button, EmptyState, Screen } from "@/components/ui";
import { isNetworkOffline } from "@/lib/network/connectivity";

export function OfflineStateScreen() {
  const setOffline = useUIStore((state) => state.setOffline);
  const retryConnection = async () => {
    const state = await NetInfo.refresh();
    setOffline(isNetworkOffline(state));
  };

  return (
    <Screen title="Offline mode">
      <EmptyState
        title="You're offline"
        body="Previously loaded content may remain available. New requests and submissions can fail until you reconnect; Hungry does not currently queue submissions."
      />
      <Button label="Retry connection" onPress={() => void retryConnection()} />
    </Screen>
  );
}
