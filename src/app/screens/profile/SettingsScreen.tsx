import { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Badge, Button, Card, Chip, InlineBanner } from "@/components/ui";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { ProfileScreenShell } from "./ProfileScreenShell";

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const signOut = useSessionStore((state) => state.signOut);
  const location = useLocationStore((state) => state.manualLocation);
  const [dietaryEnabled, setDietaryEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const handleSignOut = () => {
    signOut();
    const rootNavigation = navigation.getParent?.()?.getParent?.() ?? navigation;
    rootNavigation.navigate("Splash");
  };

  return (
    <ProfileScreenShell title="Settings" subtitle="Account, privacy, and lightweight preferences.">
      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="h3">Preferences</AppText>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Chip label="Dietary filters" selected={dietaryEnabled} onPress={() => setDietaryEnabled((value) => !value)} />
            <Chip label="Notifications" selected={notificationsEnabled} onPress={() => setNotificationsEnabled((value) => !value)} />
          </View>
          <Badge label={location ? `Manual location: ${location}` : "Location uses GPS"} tone="neutral" />
          <InlineBanner tone="info" message="This section is mock-only until backend settings exist." />
        </View>
      </Card>
      <Button label="Log out" variant="destructive" onPress={handleSignOut} />
    </ProfileScreenShell>
  );
}
