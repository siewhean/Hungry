import { useState } from "react";
import { View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronRight, Camera } from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppText, Button, Card, Chip, Input } from "@/components/ui";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
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
  const { palette, spacing, radii } = useHungryTheme();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);
  const [dietaryPreferences, setDietaryPreferencesState] = useState<DietaryFlag[]>(profile.dietaryPreferences);

  const toggleDietary = (flag: DietaryFlag) => {
    setDietaryPreferencesState((current) =>
      current.includes(flag) ? current.filter((value) => value !== flag) : [...current, flag],
    );
  };

  return (
    <ProfileScreenShell title="Edit profile" subtitle="Changes to your profile are saved locally on this device.">
      <View style={{ alignItems: "center", marginBottom: spacing[2] }}>
        <Pressable 
          style={{ position: "relative" }}
          onPress={() => showToast({ message: "Avatar upload coming soon.", tone: "info" })}
        >
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <AppText style={{ fontSize: 32, fontWeight: "700", color: palette.orange }}>
              {displayName.charAt(0).toUpperCase()}
            </AppText>
          </View>
          <View style={{ position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: palette.orange, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" }}>
            <Camera size={16} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>

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
          <Pressable 
            onPress={() => showToast({ message: "Password change flow coming soon.", tone: "info" })}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing[2] }}
          >
            <AppText style={{ fontWeight: "600" }}>Change Password</AppText>
            <ChevronRight size={18} color={palette.textMuted} />
          </Pressable>

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
