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
        body="Content you already opened stays visible. Reconnect to post reviews, save dishes or load new results."
      />
      <Button label="Retry connection" onPress={() => void retryConnection()} />
    </Screen>
  );
}
