import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronRight, Camera } from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AccessibleImage, AppText, Button, Card, Input } from "@/components/ui";
import { validateEmail } from "@/features/auth/validation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { confirmGalleryAccess, isGalleryPermissionGranted } from "@/lib/permissions/gallery";
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

export function EditProfileScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const applySavedProfileEdits = useProfileStore((state) => state.applySavedProfileEdits);
  const showToast = useUIStore((state) => state.showToast);
  const { palette, spacing, radii } = useHungryTheme();
  // The store is the source of truth. A local draft exists only while the user
  // is typing; it is cleared on every focus, so a screen instance mounted early
  // (ProfileHome preloads this route on press-in) or reopened after a save never
  // shows a stale name snapshot.
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const displayName = displayNameDraft ?? profile.displayName;
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const email = emailDraft ?? profile.email ?? "";
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      setDisplayNameDraft(null);
      setEmailDraft(null);
      setAvatarUri(undefined);
    }, []),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [canChangePassword, setCanChangePassword] = useState(false);
  const trimmedDisplayName = displayName.trim();
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

  const handlePickAvatar = async () => {
    const shouldRequestPermission = await confirmGalleryAccess({
      title: "Allow gallery access",
      message: "Hungry needs access to your photo library to update your profile picture.",
      confirmLabel: "Allow",
      cancelLabel: "Not now",
    });

    if (!shouldRequestPermission) {
      return;
    }

    const imagePicker = loadImagePickerModule();
    if (!imagePicker) {
      showToast({
        message: "Image picker unavailable right now.",
        tone: "warning",
      });
      return;
    }

    const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
    if (!isGalleryPermissionGranted(permission)) {
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
    showToast({ message: "Photo selected. Save changes to upload it.", tone: "info" });
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
          accessibilityHint="Opens your photo library to choose a new avatar"
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
            onChangeText={setDisplayNameDraft}
            error={!trimmedDisplayName}
            errorText={trimmedDisplayName ? undefined : "Display name is required."}
          />
          <View style={{ gap: spacing[1] }}>
            <Input
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmailDraft}
            />
            <AppText variant="micro" tone="muted">
              Changing your email sends confirmation links to your current and new addresses. Your
              sign-in email stays the same until both are opened.
            </AppText>
          </View>
          {canChangePassword ? (
            <Pressable
              accessibilityRole="button"
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
        disabled={!trimmedDisplayName}
        onPress={() => {
          if (!trimmedDisplayName) return;
          void (async () => {
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
                displayName: trimmedDisplayName,
                ...(avatarUri ? { avatarUrl: avatarUri } : {}),
                dietaryPreferences: profile.dietaryPreferences,
              });
              applySavedProfileEdits(savedProfile);
              setDisplayNameDraft(null);
              setEmailDraft(null);
              setAvatarUri(undefined);
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
