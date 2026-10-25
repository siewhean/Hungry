import React, { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Camera, CheckCircle2, ArrowLeft, Square, CheckSquare, Home, X } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useHungryTheme } from "@/theme";
import {
  AccessibleImage,
  AppText,
  Button,
  EmptyState,
  Screen,
  IconButton,
  Input,
  Card,
} from "@/components/ui";
import { confirmGalleryAccess, isGalleryPermissionGranted } from "@/lib/permissions/gallery";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { reportError } from "@/lib/monitoring/reportError";
import type { LocationPrivacy } from "@/types/domain";
import { trackMerchantEvent } from "@/features/merchant/merchantTracking";

type Props = NativeStackScreenProps<MerchantTabParamList, "HomeBasedVerification">;
type PickedEvidenceAsset = { uri?: string };
type ImagePickerModule = {
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted?: boolean; status?: string }>;
  launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<{
    canceled: boolean;
    assets?: PickedEvidenceAsset[];
  }>;
};

/** The copy asks for 2 food photos and 1 menu photo. */
const MIN_HOME_BASED_PHOTOS = 3;
const MAX_HOME_BASED_PHOTOS = 8;

function loadImagePickerModule(): ImagePickerModule | null {
  try {
    return require("expo-image-picker") as ImagePickerModule;
  } catch {
    return null;
  }
}

export function HomeBasedVerificationScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const setAccount = useMerchantStore((state) => state.setAccount);
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [displayName, setDisplayName] = useState(activeOutlet?.name || "");
  // Starts from the outlet's current setting; home-based is never "exact".
  const [privacy, setPrivacy] = useState<LocationPrivacy>(
    activeOutlet?.locationPrivacy === "hidden" ? "hidden" : "approximate",
  );
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [safetyChecked, setSafetyChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const photosAttached = photoUris.length > 0;
  const hasEnoughPhotos = photoUris.length >= MIN_HOME_BASED_PHOTOS;

  if (!activeOutlet) {
    return (
      <Screen style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <EmptyState
          title="No outlet selected"
          body="Choose an outlet to begin home-based verification."
          errorMessage="No active outlet was found for home-based verification."
          sendErrorContext="Home-based verification"
          icon={<Home color={palette.textMuted} size={36} />}
        />
      </Screen>
    );
  }

  const handleAttachPhotos = async () => {
    setPhotoError(null);
    try {
      const imagePicker = loadImagePickerModule();
      if (!imagePicker) {
        setPhotoError("Media picker is unavailable in this app build.");
        return;
      }

      const shouldRequestPermission = await confirmGalleryAccess({
        title: "Allow gallery access",
        message:
          "Hungry needs access to your photo library to upload photos for verification evidence.",
        confirmLabel: "Allow",
        cancelLabel: "Not now",
      });

      if (!shouldRequestPermission) {
        return;
      }

      const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
      if (!isGalleryPermissionGranted(permission)) {
        setPhotoError("Photos permission is required to attach verification evidence.");
        return;
      }

      const result = await imagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: true,
        mediaTypes: ["images"],
        quality: 0.82,
        selectionLimit: 4,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      // Added to the photos already picked (without repeats), not a replacement for them.
      const picked = result.assets
        .map((asset) => asset.uri)
        .filter((uri): uri is string => Boolean(uri));
      setPhotoUris((current) =>
        Array.from(new Set([...current, ...picked])).slice(0, MAX_HOME_BASED_PHOTOS),
      );
    } catch (e) {
      reportError(e, { screen: "HomeBasedVerification", action: "pick_photo" });
      setPhotoError("Unable to open the photo library right now.");
    }
  };

  const handleSubmit = async () => {
    if (!displayName.trim() || !hasEnoughPhotos || !safetyChecked) return;

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      // First update the profile with the specific home-based details
      await getHungryService().merchant.updateBusinessProfile(activeOutlet.id, {
        name: displayName,
        businessType: "home_based",
        locationPrivacy: privacy,
      });

      // One submission: every photo is uploaded before any evidence row or status is written.
      const [fileUrl, ...additionalFileUrls] = photoUris;
      await getHungryService().merchant.submitVerification(activeOutlet.id, {
        method: "home_based_declaration",
        fileUrl,
        additionalFileUrls,
      });
      trackMerchantEvent("merchant_verification_submitted", activeOutlet.id, {
        method: "home_based_declaration",
        photo_count: photoUris.length,
      });

      const updatedAccount = await getHungryService().merchant.getMerchantAccount();
      if (updatedAccount) setAccount(updatedAccount);

      // Go back to the Verification Centre to see the pending status
      navigation.goBack();
    } catch (e) {
      reportError(e, { screen: "HomeBasedVerification", action: "submit" });
      setSubmitError(
        e instanceof Error && e.message
          ? e.message
          : "Your verification could not be submitted. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <Screen scroll={false} fullWidth>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing[2],
          paddingVertical: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        }}
      >
        <IconButton
          icon={<ArrowLeft size={20} color={palette.text} />}
          onPress={() => navigation.goBack()}
          size={24}
          variant="ghost"
          accessibilityLabel="Back"
        />
        <AppText variant="h3" style={{ color: palette.text }}>
          Home-Based Verification
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing[4] }}>
        <AppText style={{ color: palette.textSecondary, marginBottom: spacing[4] }}>
          Please provide the following details to verify your home-based food business. Your exact
          residential address can be hidden from customers.
        </AppText>

        <Input
          label="Business profile name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g. Auntie Mary's Nasi Lemak"
          style={{ marginBottom: spacing[6] }}
        />

        <AppText variant="h3" style={{ color: palette.text, marginBottom: spacing[2] }}>
          Location privacy
        </AppText>
        <AppText
          variant="bodySmall"
          style={{ color: palette.textSecondary, marginBottom: spacing[4] }}
        >
          How should your location appear on the map?
        </AppText>

        <View accessibilityRole="radiogroup" style={{ gap: spacing[2] }}>
          {/* Home-based businesses never show an exact address to diners. */}
          <PrivacyOption
            title="Approximate area"
            description="Shows the building area only, never your unit or floor"
            selected={privacy === "approximate"}
            onSelect={() => setPrivacy("approximate")}
          />
          <PrivacyOption
            title="Hidden"
            description="Street address is not shown either"
            selected={privacy === "hidden"}
            onSelect={() => setPrivacy("hidden")}
          />
        </View>

        <AppText
          variant="h3"
          style={{ color: palette.text, marginTop: spacing[4], marginBottom: spacing[2] }}
        >
          Menu & Food Photos
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            photosAttached
              ? "Home-based verification photos attached"
              : "Attach menu and food photos"
          }
          accessibilityState={{ selected: photosAttached }}
          onPress={() => void handleAttachPhotos()}
        >
          <Card
            style={[
              {
                alignItems: "center",
                justifyContent: "center",
                padding: spacing[8],
                borderWidth: 1,
                borderStyle: "dashed",
                marginTop: spacing[2],
              },
              {
                borderColor: photosAttached ? palette.success : palette.border,
                backgroundColor: photosAttached ? palette.successSoft : palette.surface,
              },
            ]}
          >
            {photosAttached ? (
              <CheckCircle2 size={32} color={palette.success} />
            ) : (
              <Camera size={32} color={palette.textSecondary} />
            )}
            <AppText
              style={{
                color: photosAttached ? palette.success : palette.orange,
                marginTop: spacing[2],
                fontWeight: "bold",
              }}
            >
              {photosAttached
                ? `${photoUris.length} photo${photoUris.length === 1 ? "" : "s"} attached`
                : "Attach photos"}
              {photosAttached && !hasEnoughPhotos
                ? ` (${MIN_HOME_BASED_PHOTOS - photoUris.length} more needed)`
                : ""}
            </AppText>
            <AppText
              variant="micro"
              style={{
                color: palette.textSecondary,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              Provide at least 2 photos of your food and 1 photo of your menu/price list.
            </AppText>
          </Card>
        </Pressable>
        {photoUris.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing[2],
              marginTop: spacing[3],
            }}
          >
            {photoUris.map((uri, index) => (
              <View key={uri} style={{ width: 72, height: 72 }}>
                <AccessibleImage
                  source={{ uri }}
                  accessibilityLabel={`Verification photo ${index + 1}`}
                  style={{ width: 72, height: 72, borderRadius: componentRadii.input }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  hitSlop={8}
                  onPress={() => setPhotoUris((current) => current.filter((item) => item !== uri))}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: palette.text,
                  }}
                >
                  <X size={14} color={palette.bg} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {photoError ? (
          <AppText variant="micro" style={{ color: palette.error, marginTop: spacing[1] }}>
            {photoError}
          </AppText>
        ) : null}

        <AppText
          variant="h3"
          style={{ color: palette.text, marginTop: spacing[4], marginBottom: spacing[2] }}
        >
          Food Safety & Guidelines
        </AppText>

        <AppText
          variant="bodySmall"
          style={{ color: palette.textSecondary, marginBottom: spacing[2] }}
        >
          Hungry requires all home-based food businesses to comply with the Singapore Food Agency
          (SFA) guidelines for Home-Based Food Businesses.
        </AppText>

        <View
          style={[
            { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing[8] },
            { marginTop: spacing[6] },
          ]}
        >
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: safetyChecked }}
            accessibilityLabel="I acknowledge that my home-based business complies with the SFA food hygiene and safety guidelines, and I do not provide catering services."
            onPress={() => setSafetyChecked((checked) => !checked)}
            style={{ flexDirection: "row", alignItems: "flex-start", flex: 1, minHeight: 44 }}
          >
            {safetyChecked ? (
              <CheckSquare size={24} color={palette.orange} />
            ) : (
              <Square size={24} color={palette.textSecondary} />
            )}
            <AppText variant="bodySmall" style={{ color: palette.text, flex: 1, marginLeft: 8 }}>
              I acknowledge that my home-based business complies with the SFA food hygiene and
              safety guidelines, and I do not provide catering services.
            </AppText>
          </Pressable>
        </View>
      </ScrollView>

      <View
        style={[
          { padding: spacing[4], borderTopWidth: 1, paddingBottom: 32 },
          { borderTopColor: palette.border, backgroundColor: palette.bg },
        ]}
      >
        {submitError ? (
          <AppText
            variant="bodySmall"
            accessibilityRole="alert"
            style={{ color: palette.error, marginBottom: spacing[2] }}
          >
            {submitError}
          </AppText>
        ) : null}
        <Button
          label="Submit verification"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!displayName.trim() || !hasEnoughPhotos || !safetyChecked || isSubmitting}
          style={{ width: "100%" }}
        />
      </View>
    </Screen>
  );
}

// Inline helper for privacy options
function PrivacyOption({
  title,
  description,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={onSelect}
    >
      <Card
        style={[
          { flexDirection: "row", alignItems: "center", padding: spacing[4], borderWidth: 1 },
          {
            borderColor: selected ? palette.orange : palette.border,
            backgroundColor: selected ? palette.orangeLight : palette.surface,
            borderRadius: componentRadii.card,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <AppText style={{ color: palette.text, fontWeight: "bold" }}>{title}</AppText>
          <AppText variant="micro" style={{ color: palette.textSecondary, marginTop: 2 }}>
            {description}
          </AppText>
        </View>
        {selected && <CheckCircle2 size={20} color={palette.orange} />}
      </Card>
    </Pressable>
  );
}
