import { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppText, Button, Card, Input } from "@/components/ui";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "EditProfile">;

export function EditProfileScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const showToast = useUIStore((state) => state.showToast);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);

  return (
    <ProfileScreenShell title="Edit profile" subtitle="Keep the basics current while the rest of the profile stays lightweight.">
      <Card>
        <View style={{ gap: 12 }}>
          <Input label="Display name" value={displayName} onChangeText={setDisplayName} />
          <Input
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>
      </Card>
      <Button
        label="Save changes"
        onPress={() => {
          updateProfile({ displayName, email });
          showToast({ message: "Profile updated locally.", tone: "success" });
          navigation.goBack();
        }}
      />
      <AppText variant="bodySmall" tone="muted">
        This mock build keeps profile editing local to the device state.
      </AppText>
    </ProfileScreenShell>
  );
}
