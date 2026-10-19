import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronRight, Camera } from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AccessibleImage, AppText, Button, Card, Input } from "@/components/ui";
import { validateEmail } from "@/features/auth/validation";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "EditProfile">;

function loadImagePickerModule() {
  try {
    return require("expo-image-picker") as {
      launchImageLibraryAsync: (options: {
        allowsEditing: boolean;
        aspect: [number, number];
        quality: number;
        mediaTypes: "images"[];
      }) => Promise<{ canceled: boolean; assets?: { uri: string }[] }>;
    };
  } catch {
    return null;
  }
}

export function EditProfileScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const applyProfile = useProfileStore((state) => state.applyProfile);
  const showToast = useUIStore((state) => state.showToast);
  const { palette, spacing, radii } = useHungryTheme();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [canChangePassword, setCanChangePassword] = useState(false);
  const avatarPreviewUri = avatarUri ?? profile.avatarUrl;
  const avatarSize = spacing[20];
  const avatarInitials = useMemo(
    () =>
      displayName
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "HU",
    [displayName],
  );

  const trimmedName = displayName.trim();
  const nameError = trimmedName ? undefined : "Enter a display name.";
  const isDirty =
    trimmedName !== profile.displayName.trim() ||
    email.trim().toLowerCase() !== (profile.email ?? "").trim().toLowerCase() ||
    avatarUri !== undefined;
  // Saving (or leaving after a save) must not trigger the unsaved-changes prompt.
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!isDirty || allowLeaveRef.current) return;
      event.preventDefault();
      Alert.alert("Discard changes?", "Your profile changes haven't been saved.", [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => navigation.dispatch(event.data.action),
        },
      ]);
    });
    return unsubscribe;
  }, [isDirty, navigation]);

  const handlePickAvatar = async () => {
    // The system photo picker needs no library permission, so there is no pre-prompt.
    const imagePicker = loadImagePickerModule();
    if (!imagePicker) {
      showToast({
        message: "Image picker unavailable right now.",
        tone: "warning",
      });
      return;
    }

    const result = await imagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    setAvatarUri(result.assets[0].uri);
    showToast({ message: "Photo selected. Tap Save changes to use it.", tone: "info" });
  };

  useEffect(() => {
    let isActive = true;
    // Google/Apple-only accounts have no password to change, so the row stays hidden.
    getHungryService()
      .auth.canChangePassword()
      .then((allowed) => {
        if (isActive) setCanChangePassword(allowed);
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
    };
  }, []);

  const handleChangePassword = () => {
    getRootNavigation(navigation).navigate("ChangePassword");
  };

  return (
    <ProfileScreenShell title="Edit profile">
      <View style={{ alignItems: "center", marginBottom: spacing[2] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          style={{ position: "relative" }}
          onPress={() => {
            void handlePickAvatar();
          }}
        >
          <View
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: radii.pill,
              backgroundColor: palette.bgSoft,
              borderWidth: 2,
              borderColor: palette.surface,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {avatarPreviewUri ? (
              <AccessibleImage
                source={{ uri: avatarPreviewUri }}
                style={{ height: "100%", width: "100%" }}
                contentFit="cover"
                accessibilityLabel="Profile avatar preview"
              />
            ) : (
              <AppText
                variant="h1"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                style={{
                  color: palette.orange,
                  textAlign: "center",
                }}
              >
                {avatarInitials}
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
          <Input
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            errorText={nameError}
            error={Boolean(nameError)}
          />
          <Input
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <AppText variant="micro" tone="muted">
            Changing your email sends confirmation links to your current and new addresses. Your
            sign-in email stays the same until both are opened.
          </AppText>
          {canChangePassword ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change password"
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
          ) : null}
        </View>
      </Card>
      <Button
        label="Save changes"
        loading={isSaving}
        disabled={!isDirty || Boolean(nameError)}
        onPress={() => {
          void (async () => {
            if (nameError) {
              showToast({ message: nameError, tone: "warning" });
              return;
            }
            const nextEmail = email.trim().toLowerCase();
            const emailChanged = nextEmail !== (profile.email ?? "").trim().toLowerCase();
            if (emailChanged) {
              const emailCheck = validateEmail(nextEmail);
              if (emailCheck !== true) {
                showToast({ message: emailCheck, tone: "warning" });
                return;
              }
            }
            setIsSaving(true);
            try {
              const savedProfile = await getHungryService().profile.updateProfile({
                displayName: trimmedName,
                avatarUrl: avatarUri,
                dietaryPreferences: profile.dietaryPreferences,
              });
              applyProfile(savedProfile);
              allowLeaveRef.current = true;
              trackAnalyticsEvent("profile_updated", {
                name_changed: trimmedName !== profile.displayName.trim(),
                avatar_changed: avatarUri !== undefined,
                email_change_requested: emailChanged,
              });
              if (emailChanged) {
                try {
                  await getHungryService().auth.requestEmailChange(nextEmail);
                  showToast({
                    message: `Check your current inbox and ${nextEmail} for links to confirm the change.`,
                    tone: "success",
                  });
                } catch {
                  showToast({
                    message: "Profile saved, but we could not start the email change.",
                    tone: "warning",
                  });
                  return;
                }
              } else {
                showToast({ message: "Profile updated.", tone: "success" });
              }
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
