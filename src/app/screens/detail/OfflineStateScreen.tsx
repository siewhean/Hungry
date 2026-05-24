import { useUIStore } from "@/store/useUIStore";
import { Button, EmptyState, Screen } from "@/components/ui";

export function OfflineStateScreen() {
  const setOffline = useUIStore((state) => state.setOffline);

  return (
    <Screen title="Offline mode">
      <EmptyState
        title="You're offline"
        body="Nearby results, building detail, and saved content stay visible. Submit actions wait until the connection returns."
      />
      <Button label="Return to app" onPress={() => setOffline(false)} />
    </Screen>
  );
}
