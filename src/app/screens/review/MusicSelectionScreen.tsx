import { useNavigation } from "@react-navigation/native";
import { AppText, Button, Screen } from "@/components/ui";
export function MusicSelectionScreen() {
  const navigation = useNavigation();
  return (
    <Screen title="Review music">
      <AppText>Music attachments are unavailable in this version.</AppText>
      <Button label="Back" onPress={() => navigation.goBack()} />
    </Screen>
  );
}
