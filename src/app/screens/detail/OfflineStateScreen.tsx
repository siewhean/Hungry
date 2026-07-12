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
        body="Nearby results, building detail, and saved content stay visible. Submit actions wait until the connection returns."
      />
      <Button label="Retry connection" onPress={() => void retryConnection()} />
    </Screen>
  );
}
