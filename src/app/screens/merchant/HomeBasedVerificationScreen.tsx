import { useMerchantOperationScope } from "@/features/merchant/useMerchantOperationScope";
import React, { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Camera, CheckCircle2, ArrowLeft, Square, CheckSquare, Home } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useHungryTheme } from "@/theme";
import { AppText, Button, EmptyState, Screen, IconButton, Input, Card } from "@/components/ui";
import { confirmGalleryAccess, isGalleryPermissionGranted } from "@/lib/permissions/gallery";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { LocationPrivacy } from "@/types/domain";

type Props = NativeStackScreenProps<MerchantTabParamList, "HomeBasedVerification">;
type PickedEvidenceAsset = { uri?: string };
type ImagePickerModule = {
  MediaTypeOptions: { Images: unknown };
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted?: boolean; status?: string }>;
  launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<{
    canceled: boolean;
    assets?: PickedEvidenceAsset[];
  }>;
};

function loadImagePickerModule(): ImagePickerModule | null {
  try {
    return require("expo-image-picker") as ImagePickerModule;
  } catch {
    return null;
  }
}

export function HomeBasedVerificationScreen({ navigation }: Props) {
  const captureOperation = useMerchantOperationScope();

  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const setAccount = useMerchantStore((state) => state.setAccount);
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [displayName, setDisplayName] = useState(activeOutlet?.name || "");
  const [privacy, setPrivacy] = useState<LocationPrivacy>("approximate");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [safetyChecked, setSafetyChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const photosAttached = photoUris.length >= 3;

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
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

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
      if (!isOperationCurrent()) return;

      if (!shouldRequestPermission) {
        return;
      }

      const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
      if (!isOperationCurrent()) return;

      if (!isGalleryPermissionGranted(permission)) {
        setPhotoError("Photos permission is required to attach verification evidence.");
        return;
      }

      const result = await imagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: true,
        mediaTypes: imagePicker.MediaTypeOptions.Images,
        quality: 0.82,
        selectionLimit: 4,
      });
      if (!isOperationCurrent()) return;

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setPhotoUris(
        result.assets.map((asset) => asset.uri).filter((uri): uri is string => Boolean(uri)),
      );
    } catch {
      if (!isOperationCurrent()) return;

      setPhotoError("Unable to open the photo library right now.");
    }
  };

  const handleSubmit = async () => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    if (isSubmitting || !displayName.trim() || !photosAttached || !safetyChecked) return;

    setIsSubmitting(true);
    try {
      // First update the profile with the specific home-based details
      await getHungryService().merchant.updateBusinessProfile(activeOutlet.id, {
        name: displayName,
        locationPrivacy: privacy,
      });
      if (!isOperationCurrent()) return;

      await getHungryService().merchant.submitVerification(
        activeOutlet.id,
        photoUris.map((fileUrl) => ({
          method: "home_based_declaration" as const,
          fileUrl,
          reviewNote:
            "Merchant confirms these include two food photos and one menu photo, and confirms food safety declaration.",
        })),
      );
      if (!isOperationCurrent()) return;

      const updatedAccount = await getHungryService().merchant.getMerchantAccount();
      if (!isOperationCurrent()) return;

      if (updatedAccount) setAccount(updatedAccount);

      // Go back to the Verification Centre to see the pending status
      navigation.goBack();
    } catch (e) {
      if (!isOperationCurrent()) return;

      setPhotoError(
        e instanceof Error
          ? e.message
          : "Verification could not be submitted. Your evidence remains available to retry.",
      );
    } finally {
      if (isOperationCurrent()) {
        setIsSubmitting(false);
      }
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
          Please provide the following details to verify your home-based food business. Home-based
          publication is unavailable until server location privacy has been verified.
        </AppText>

        <Input
          label="Business Profile Name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g. Auntie Mary's Nasi Lemak"
          style={{ marginBottom: spacing[6] }}
        />

        <AppText variant="h3" style={{ color: palette.text, marginBottom: spacing[2] }}>
          Location Privacy
        </AppText>
        <AppText
          variant="bodySmall"
          style={{ color: palette.textSecondary, marginBottom: spacing[4] }}
        >
          How should your location appear on the map?
        </AppText>

        <View style={{ gap: spacing[2] }}>
          <PrivacyOption
            title="Approximate Area"
            description="Requested coarse location; publication remains unavailable pending privacy verification"
            selected={privacy === "approximate"}
            onSelect={() => setPrivacy("approximate")}
          />
          <PrivacyOption
            title="Hidden"
            description="Requested hidden location; publication remains unavailable pending privacy verification"
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
          <IconButton
            icon={
              safetyChecked ? (
                <CheckSquare size={20} color={palette.orange} />
              ) : (
                <Square size={20} color={palette.textSecondary} />
              )
            }
            size={24}
            variant="ghost"
            accessibilityLabel="Safety acknowledgement checkbox"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: safetyChecked }}
            onPress={() => setSafetyChecked(!safetyChecked)}
          />
          <AppText variant="bodySmall" style={{ color: palette.text, flex: 1, marginLeft: 8 }}>
            I acknowledge that my home-based business complies with the SFA food hygiene and safety
            guidelines, and I do not provide catering services.
          </AppText>
        </View>
      </ScrollView>

      <View
        style={[
          { padding: spacing[4], borderTopWidth: 1, paddingBottom: 32 },
          { borderTopColor: palette.border, backgroundColor: palette.bg },
        ]}
      >
        <Button
          label="Submit Verification"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!displayName.trim() || !photosAttached || !safetyChecked || isSubmitting}
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
      accessibilityLabel={title}
      accessibilityState={{ checked: selected }}
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
