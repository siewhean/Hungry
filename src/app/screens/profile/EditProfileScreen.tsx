import { useState } from "react";
import { View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronRight, Camera } from "lucide-react-native";
import { Image } from "expo-image";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppText, Button, Card, Chip, Input } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { DietaryFlag } from "@/types/domain";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "EditProfile">;

function loadImagePickerModule() {
  try {
    return require("expo-image-picker") as {
      MediaTypeOptions: { Images: string };
      requestMediaLibraryPermissionsAsync: () => Promise<{ status: string }>;
      launchImageLibraryAsync: (options: {
        allowsEditing: boolean;
        aspect: [number, number];
        quality: number;
        mediaTypes: string;
      }) => Promise<{ canceled: boolean; assets?: { uri: string }[] }>;
    };
  } catch {
    return null;
  }
}

const EDITABLE_DIETARY_OPTIONS: { label: string; value: DietaryFlag }[] = [
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
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);
  const [dietaryPreferences, setDietaryPreferencesState] = useState<DietaryFlag[]>(
    profile.dietaryPreferences,
  );
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const handlePickAvatar = async () => {
    const imagePicker = loadImagePickerModule();
    if (!imagePicker) {
      showToast({
        message: "Image picker unavailable right now.",
        tone: "warning",
      });
      return;
    }

    const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      showToast({
        message: "Photo permission is required to update your avatar.",
        tone: "warning",
      });
      return;
    }

    const result = await imagePicker.launchImageLibraryAsync({
      mediaTypes: imagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    setAvatarUri(result.assets[0].uri);
    showToast({ message: "Profile photo updated.", tone: "success" });
  };

  const toggleDietary = (flag: DietaryFlag) => {
    setDietaryPreferencesState((current) =>
      current.includes(flag) ? current.filter((value) => value !== flag) : [...current, flag],
    );
  };

  const handleChangePassword = () => {
    const rootNavigation = getRootNavigation(navigation);
    rootNavigation.navigate("AuthStack", {
      screen: "ResetPassword",
      params: { email, code: "profile-settings" },
    });
  };

  return (
    <ProfileScreenShell
      title="Edit profile"
      subtitle="Changes sync to your account when connected."
    >
      <View style={{ alignItems: "center", marginBottom: spacing[2] }}>
        <Pressable
          style={{ position: "relative" }}
          onPress={() => {
            void handlePickAvatar();
          }}
        >
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: componentRadii.iconButton,
              backgroundColor: palette.bgSoft,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={{ height: "100%", width: "100%" }}
                contentFit="cover"
              />
            ) : (
              <AppText
                style={{
                  fontSize: 32,
                  fontWeight: "700",
                  color: palette.orange,
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </AppText>
            )}
          </View>
          <View
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 32,
              height: 32,
              borderRadius: radii.pill,
              backgroundColor: palette.orange,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: palette.surface,
            }}
          >
            <Camera size={16} color={palette.surface} />
          </View>
        </Pressable>
      </View>

      <Card>
        <View style={{ gap: spacing[3] }}>
          <Input label="Display name" value={displayName} onChangeText={setDisplayName} />
          <Input
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Pressable
            onPress={handleChangePassword}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: spacing[2],
            }}
          >
            <AppText style={{ fontWeight: "600" }}>Change Password</AppText>
            <ChevronRight size={18} color={palette.textMuted} />
          </Pressable>

          <AppText variant="h3">Dietary preferences</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
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
        loading={isSaving}
        onPress={() => {
          void (async () => {
            setIsSaving(true);
            try {
              await getHungryService().profile.updateProfile({
                displayName,
                email,
                avatarUrl: avatarUri,
              });
              await getHungryService().profile.updateDietaryPreferences(dietaryPreferences);
              updateProfile({ displayName, email, avatarUrl: avatarUri });
              setDietaryPreferences(dietaryPreferences);
              showToast({ message: "Profile updated.", tone: "success" });
              navigation.goBack();
            } catch {
              showToast({
                message: "Could not save profile right now.",
                tone: "warning",
              });
            } finally {
              setIsSaving(false);
            }
          })();
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
