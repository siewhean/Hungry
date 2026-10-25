import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, View, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Camera } from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AccessibleImage, AppText, Button, Card, Input } from "@/components/ui";
import { validateEmail } from "@/features/auth/validation";
import { PROFILE_BIO_MAX_LENGTH } from "@/features/profile/profileBio";
import {
  PROFILE_DISPLAY_NAME_MAX_LENGTH,
  profileTextRefusalHint,
  validateDisplayName,
} from "@/features/profile/profileName";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
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
  const applySavedProfileEdits = useProfileStore((state) => state.applySavedProfileEdits);
  const showToast = useUIStore((state) => state.showToast);
  const { palette, spacing, radii } = useHungryTheme();
  // The store is the source of truth. A local draft exists only while the user
  // is typing (null shows the store value), so a screen instance mounted early
  // (ProfileHome preloads this route on press-in) never shows a stale snapshot.
  // Drafts survive a trip to the taste quiz and back; a save clears them.
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const displayName = displayNameDraft ?? profile.displayName;
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const email = emailDraft ?? profile.email ?? "";
  const [bioDraft, setBioDraft] = useState<string | null>(null);
  const bio = bioDraft ?? profile.bio ?? "";
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // New address of an email change still waiting for its confirmation links.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const avatarPreviewUri = removeAvatar ? undefined : (avatarUri ?? profile.avatarUrl);
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
  const nameError = validateDisplayName(displayName);
  const trimmedBio = bio.trim();
  const bioChanged = trimmedBio !== (profile.bio ?? "").trim();
  const isDirty =
    trimmedName !== profile.displayName.trim() ||
    bioChanged ||
    email.trim().toLowerCase() !== (profile.email ?? "").trim().toLowerCase() ||
    avatarUri !== undefined ||
    removeAvatar;
  // Saving (or leaving after a save) must not trigger the unsaved-changes prompt.
  const allowLeaveRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      allowLeaveRef.current = false;
    }, []),
  );
  const clearDrafts = () => {
    setDisplayNameDraft(null);
    setEmailDraft(null);
    setBioDraft(null);
    setAvatarUri(undefined);
    setRemoveAvatar(false);
  };

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
    setRemoveAvatar(false);
    showToast({ message: "Photo selected. Tap Save changes to use it.", tone: "info" });
  };

  useEffect(() => {
    let isActive = true;
    getHungryService()
      .auth.getPendingEmailChange()
      .then((pending) => {
        if (isActive) setPendingEmail(pending);
      })
      .catch((error: unknown) => reportError(error, { area: "edit_profile_pending_email" }));
    return () => {
      isActive = false;
    };
  }, []);

  const handleRemovePhoto = () => {
    setAvatarUri(undefined);
    setRemoveAvatar(true);
    showToast({ message: "Photo removed. Tap Save changes to confirm.", tone: "info" });
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
            <Camera size={16} color={palette.textOnOrange} />
          </View>
        </Pressable>
        {avatarPreviewUri ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove profile photo"
            onPress={handleRemovePhoto}
            style={{ minHeight: 44, justifyContent: "center", marginTop: spacing[1] }}
          >
            <AppText variant="bodySmall" style={{ color: palette.error, fontWeight: "600" }}>
              Remove photo
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <Card>
        <View style={{ gap: spacing[3] }}>
          <Input
            label="Display name"
            value={displayName}
            onChangeText={setDisplayNameDraft}
            maxLength={PROFILE_DISPLAY_NAME_MAX_LENGTH}
            errorText={nameError}
            error={Boolean(nameError)}
          />
          <Input
            label="Bio"
            placeholder="A line about what you love to eat"
            value={bio}
            onChangeText={setBioDraft}
            multiline
            maxLength={PROFILE_BIO_MAX_LENGTH}
            accessibilityHint={`Up to ${PROFILE_BIO_MAX_LENGTH} characters`}
            helperText={`${bio.length}/${PROFILE_BIO_MAX_LENGTH}`}
          />
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
          {pendingEmail ? (
            <AppText variant="micro" tone="muted">
              Waiting for confirmation: {pendingEmail}. Open the links we emailed to both addresses
              to finish.
            </AppText>
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
                ...(bioChanged ? { bio: trimmedBio } : {}),
                // An empty avatarUrl removes the photo; no new photo leaves it unchanged.
                ...(removeAvatar ? { avatarUrl: "" } : avatarUri ? { avatarUrl: avatarUri } : {}),
                dietaryPreferences: profile.dietaryPreferences,
              });
              applySavedProfileEdits(savedProfile);
              clearDrafts();
              allowLeaveRef.current = true;
              trackAnalyticsEvent("profile_updated", {
                name_changed: trimmedName !== profile.displayName.trim(),
                bio_changed: bioChanged,
                avatar_changed: avatarUri !== undefined || removeAvatar,
                email_change_requested: emailChanged,
              });
              if (emailChanged) {
                try {
                  await getHungryService().auth.requestEmailChange(nextEmail);
                  showToast({
                    message: `Check your current inbox and ${nextEmail} for links to confirm the change.`,
                    tone: "success",
                  });
                } catch (error) {
                  reportError(error, { area: "edit_profile_email_change" });
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
            } catch (error) {
              const refusal = profileTextRefusalHint(error);
              // A refused name or bio is the person's to fix; anything else is unexpected.
              if (!refusal) reportError(error, { screen: "EditProfile", action: "save_profile" });
              showToast({
                message:
                  refusal === "display_name_reserved"
                    ? "That display name is reserved. Please choose another."
                    : refusal === "display_name_too_long"
                      ? `Use ${PROFILE_DISPLAY_NAME_MAX_LENGTH} characters or fewer for your name.`
                      : refusal === "display_name_blocked_term"
                        ? "That display name contains words we don't allow."
                        : refusal === "bio_text_not_allowed"
                          ? "Your bio contains words or links we don't allow. Please edit it."
                          : "Could not save profile right now.",
                tone: "warning",
              });
            } finally {
              setIsSaving(false);
            }
          })();
        }}
      />
      <Button
        label="Retake the taste quiz"
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
