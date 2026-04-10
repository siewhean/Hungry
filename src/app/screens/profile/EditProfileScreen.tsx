import { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppText, Button, Card, Chip, Input } from "@/components/ui";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import type { DietaryFlag } from "@/types/domain";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "EditProfile">;

const EDITABLE_DIETARY_OPTIONS: Array<{ label: string; value: DietaryFlag }> = [
  { label: "Halal", value: "halal" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Vegan", value: "vegan" },
  { label: "Gluten free", value: "gluten_free" },
  { label: "Nut free", value: "nut_free" },
  { label: "Pork free", value: "pork_free" },
  { label: "Dairy free", value: "dairy_free" },
  { label: "Seafood free", value: "shellfish_free" },
];

export function EditProfileScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const setDietaryPreferences = useProfileStore((state) => state.setDietaryPreferences);
  const showToast = useUIStore((state) => state.showToast);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);
  const [dietaryPreferences, setDietaryPreferencesState] = useState<DietaryFlag[]>(profile.dietaryPreferences);

  const toggleDietary = (flag: DietaryFlag) => {
    setDietaryPreferencesState((current) =>
      current.includes(flag) ? current.filter((value) => value !== flag) : [...current, flag],
    );
  };

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
          <AppText variant="h3">Dietary preferences</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {EDITABLE_DIETARY_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={dietaryPreferences.includes(option.value)}
                onPress={() => toggleDietary(option.value)}
              />
            ))}
          </View>
        </View>
      </Card>
      <Button
        label="Save changes"
        onPress={() => {
          updateProfile({ displayName, email });
          setDietaryPreferences(dietaryPreferences);
          showToast({ message: "Profile updated locally.", tone: "success" });
          navigation.goBack();
        }}
      />
      <Button
        label="Retake taste quiz"
        variant="secondary"
        onPress={() => {
          const rootNavigation = getRootNavigation(navigation);
          rootNavigation.navigate("OnboardingStack", {
            screen: "TasteQuiz",
            params: { mode: "profile" },
          });
        }}
      />
    </ProfileScreenShell>
  );
}
