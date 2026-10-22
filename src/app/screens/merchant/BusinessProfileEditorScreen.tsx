import { useMerchantOperationScope } from "@/features/merchant/useMerchantOperationScope";
import { useMerchantDirtyExit } from "@/features/merchant/useMerchantDirtyExit";
import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Camera, Image as ImageIcon } from "lucide-react-native";
import { useForm, Controller } from "react-hook-form";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  AccessibleImage,
  AppText,
  Button,
  EmptyState,
  FormSwitchRow,
  Input,
  Screen,
  SelectField,
} from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { confirmGalleryAccess, isGalleryPermissionGranted } from "@/lib/permissions/gallery";
import type { MerchantOutlet, LocationPrivacy } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { formatBusinessType } from "@/features/merchant/merchantReadiness";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "BusinessProfileEditor">;

type FormData = {
  name: string;
  description: string;
  businessType: MerchantOutlet["businessType"];
  cuisineCategories: string;
  unitNumber: string;
  floor: string;
  locationPrivacy: LocationPrivacy;
  operatingHours: string;
  temporaryClosure: string;
  profilePhotoUrl: string;
  coverPhotoUrl: string;
  contactPhone: string;
  contactEmail: string;
  dietaryLabels: string;
  tasteTags: string;
};

const BUSINESS_TYPE_OPTIONS: MerchantOutlet["businessType"][] = [
  "hawker_stall",
  "food_court_stall",
  "restaurant",
  "cafe",
  "mall_tenant",
  "home_based",
];
const BUSINESS_TYPE_SELECT_OPTIONS = BUSINESS_TYPE_OPTIONS.map((value) => ({
  label: formatBusinessType(value),
  value,
}));

function loadImagePickerModule() {
  try {
    return require("expo-image-picker");
  } catch {
    return null;
  }
}

function BusinessTypeDropdown({
  value,
  onChange,
}: {
  value: MerchantOutlet["businessType"];
  onChange: (value: MerchantOutlet["businessType"]) => void;
}) {
  return (
    <SelectField
      label="Business Type"
      value={value}
      options={BUSINESS_TYPE_SELECT_OPTIONS}
      onChange={onChange}
    />
  );
}

function BusinessImageField({
  label,
  value,
  onChange,
  isSaving,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isSaving: boolean;
  icon: React.ReactNode;
}) {
  const captureOperation = useMerchantOperationScope();

  const { componentRadii, palette, spacing } = useHungryTheme();
  const [error, setError] = useState<string | null>(null);

  const handlePick = async () => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    try {
      setError(null);
      const imagePicker = loadImagePickerModule();
      if (!imagePicker) {
        setError("Photo picker is unavailable in this build.");
        return;
      }

      const shouldRequestPermission = await confirmGalleryAccess({
        title: "Allow gallery access",
        message:
          "Hungry needs access to your photo library to upload your profile image for the outlet.",
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
        setError("Photos permission is required to upload this image.");
        return;
      }
      const result = await imagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        mediaTypes: imagePicker.MediaTypeOptions.Images,
        quality: 0.82,
        selectionLimit: 1,
      });
      if (!isOperationCurrent()) return;

      if (result.canceled || !result.assets?.length) return;
      onChange(result.assets[0].uri);
    } catch {
      if (!isOperationCurrent()) return;

      setError("Unable to open the photo library right now.");
    }
  };

  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="bodyBold">{label}</AppText>
      {value.trim() ? (
        <AccessibleImage
          source={{ uri: value.trim() }}
          style={[
            styles.photoPreview,
            { borderRadius: componentRadii.input, borderColor: palette.border },
          ]}
          accessibilityLabel={`${label} preview`}
        />
      ) : (
        <View
          accessibilityLabel={`${label} preview`}
          style={[
            styles.photoPlaceholder,
            {
              backgroundColor: palette.bgSoft,
              borderColor: palette.border,
              borderRadius: componentRadii.input,
            },
          ]}
        >
          {icon}
          <AppText variant="micro" tone="muted" style={{ marginTop: 4 }}>
            Upload from your phone or gallery.
          </AppText>
        </View>
      )}
      {isSaving && value ? (
        <AppText variant="micro" tone="muted">
          Uploading and saving image...
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="micro" style={{ color: palette.error }}>
          {error}
        </AppText>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        <Button label={value ? "Replace" : "Upload"} variant="secondary" onPress={handlePick} />
        {value ? <Button label="Remove" variant="ghost" onPress={() => onChange("")} /> : null}
      </View>
    </View>
  );
}

export function BusinessProfileEditorScreen() {
  const captureOperation = useMerchantOperationScope();

  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const rootNavigation = getRootNavigation(navigation as any);
  const repository = getDataRepository();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const updateOutletProfile = useMerchantStore((state) => state.updateOutletProfile);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  useEffect(() => setIsUploadingImages(false), [activeOutlet?.id]);

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    getValues,
    formState: { isSubmitting, errors, isDirty },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      description: "",
      businessType: "hawker_stall",
      cuisineCategories: "",
      unitNumber: "",
      floor: "",
      locationPrivacy: "exact",
      operatingHours: "",
      temporaryClosure: "",
      profilePhotoUrl: "",
      coverPhotoUrl: "",
      contactPhone: "",
      contactEmail: "",
      dietaryLabels: "",
      tasteTags: "",
    },
  });

  const finishBack = useMerchantDirtyExit(isDirty, isSubmitting);
  useEffect(() => {
    if (activeOutlet) {
      setValue("name", activeOutlet.name || "");
      setValue("description", activeOutlet.description || "");
      setValue("businessType", activeOutlet.businessType || "hawker_stall");
      setValue("cuisineCategories", activeOutlet.cuisineCategories?.join(", ") || "");
      setValue("unitNumber", activeOutlet.unitNumber || "");
      setValue("floor", activeOutlet.floor || "");
      setValue("locationPrivacy", activeOutlet.locationPrivacy || "exact");
      setValue("operatingHours", activeOutlet.operatingHours || "");
      setValue("temporaryClosure", activeOutlet.temporaryClosure || "");
      setValue("profilePhotoUrl", activeOutlet.profilePhotoUrl || "");
      setValue("coverPhotoUrl", activeOutlet.coverPhotoUrl || "");
      setValue("contactPhone", activeOutlet.contactPhone || "");
      setValue("contactEmail", activeOutlet.contactEmail || "");
      setValue("dietaryLabels", activeOutlet.dietaryLabels?.join(", ") || "");
      setValue("tasteTags", activeOutlet.tasteTags?.join(", ") || "");
      reset(getValues());
    }
  }, [activeOutlet?.id, setValue, reset, getValues]);

  const onSubmit = async (data: FormData) => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    if (!activeOutlet) return;
    try {
      const profilePhotoUrl = data.profilePhotoUrl.trim();
      const coverPhotoUrl = data.coverPhotoUrl.trim();
      setIsUploadingImages(
        [profilePhotoUrl, coverPhotoUrl].some(
          (value) =>
            value.startsWith("file://") || value.startsWith("content://") || value.startsWith("/"),
        ),
      );
      const galleryUrls = Array.from(
        new Set(
          [
            profilePhotoUrl,
            coverPhotoUrl,
            ...activeOutlet.galleryUrls.filter(
              (url) => url !== activeOutlet.profilePhotoUrl && url !== activeOutlet.coverPhotoUrl,
            ),
          ].filter(Boolean),
        ),
      );
      const updates: Partial<MerchantOutlet> = {
        name: data.name,
        description: data.description,
        businessType: data.businessType,
        cuisineCategories: data.cuisineCategories
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        unitNumber: data.unitNumber,
        floor: data.floor,
        locationPrivacy: data.locationPrivacy,
        operatingHours: data.operatingHours,
        temporaryClosure: data.temporaryClosure,
        profilePhotoUrl,
        coverPhotoUrl,
        galleryUrls,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        dietaryLabels: data.dietaryLabels
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean) as any,
        tasteTags: data.tasteTags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const updated = await getHungryService().merchant.updateBusinessProfile(
        activeOutlet.id,
        updates,
      );
      if (!isOperationCurrent()) return;

      updateOutletProfile(activeOutlet.id, updated);
      reset({
        ...data,
        profilePhotoUrl: updated.profilePhotoUrl ?? "",
        coverPhotoUrl: updated.coverPhotoUrl ?? "",
      });
      Alert.alert("Success", "Profile updated successfully!");
      finishBack();
    } catch (error) {
      if (!isOperationCurrent()) return;

      console.error(error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      if (isOperationCurrent()) {
        setIsUploadingImages(false);
      }
    }
  };

  const handlePreviewAsCustomer = () => {
    if (!activeOutlet) {
      return;
    }

    const signatureDishId = activeOutlet.signatureDishIds[0];
    const signatureVenueId = signatureDishId
      ? repository.getDishById(signatureDishId)?.venueId
      : undefined;
    const venueId = signatureVenueId;

    if (venueId) {
      rootNavigation.navigate("StallDetail", { venueId });
    } else {
      Alert.alert("Preview unavailable", "This outlet has no linked public venue yet.");
    }
  };

  if (!activeOutlet) {
    return (
      <Screen title="Error">
        <EmptyState
          title="No active outlet selected"
          body="A business profile cannot be loaded until you choose a merchant outlet."
          errorMessage="No active outlet was found for this merchant session."
          sendErrorContext="Business profile editor"
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Business Profile"
      contentContainerStyle={{ paddingBottom: spacing[6] }}
      headerRight={
        <TouchableOpacity
          onPress={handlePreviewAsCustomer}
          style={[
            styles.previewButton,
            {
              paddingVertical: spacing[1],
              paddingHorizontal: spacing[3],
              borderRadius: radii.pill,
            },
            { backgroundColor: palette.bgSoft, borderColor: palette.border },
          ]}
        >
          <AppText variant="bodySmallBold" tone="muted">
            Preview
          </AppText>
        </TouchableOpacity>
      }
    >
      <View style={{ gap: spacing[6], width: "100%" }}>
        {activeOutlet.verification?.status === "verified" && (
          <View
            style={[
              styles.verifiedBadge,
              {
                paddingVertical: spacing[2],
                paddingHorizontal: spacing[3],
                borderRadius: componentRadii.card,
              },
              { backgroundColor: palette.successSoft, borderColor: palette.success },
            ]}
          >
            <AppText variant="bodySmallBold" style={{ color: palette.success }}>
              ✓ Verified by Hungry
            </AppText>
          </View>
        )}

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Basic Info
          </AppText>

          <View>
            <Controller
              control={control}
              name="name"
              rules={{ required: "Name is required" }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Business Name *"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. Uncle Tan's Chicken Rice"
                  error={Boolean(errors.name)}
                  errorText={errors.name?.message}
                />
              )}
            />
          </View>

          <View>
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Description"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  multiline
                  numberOfLines={4}
                  placeholder="Tell customers about your business..."
                  style={{ minHeight: 100, textAlignVertical: "top" }}
                />
              )}
            />
          </View>

          <View>
            <Controller
              control={control}
              name="businessType"
              render={({ field: { onChange, value } }) => (
                <BusinessTypeDropdown value={value} onChange={onChange} />
              )}
            />
          </View>
        </View>

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Photos
          </AppText>

          <View style={{ gap: spacing[4] }}>
            <Controller
              control={control}
              name="profilePhotoUrl"
              render={({ field: { onChange, value } }) => (
                <BusinessImageField
                  label="Profile Image"
                  value={value}
                  onChange={onChange}
                  isSaving={isUploadingImages}
                  icon={<Camera size={24} color={palette.textMuted} />}
                />
              )}
            />

            <Controller
              control={control}
              name="coverPhotoUrl"
              render={({ field: { onChange, value } }) => (
                <BusinessImageField
                  label="Cover Image"
                  value={value}
                  onChange={onChange}
                  isSaving={isUploadingImages}
                  icon={<ImageIcon size={24} color={palette.textMuted} />}
                />
              )}
            />
          </View>
        </View>

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Tags & Categories
          </AppText>

          <View>
            <Controller
              control={control}
              name="cuisineCategories"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Cuisine Categories"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. Chinese, Noodles (comma-separated)"
                />
              )}
            />
          </View>

          <View>
            <Controller
              control={control}
              name="dietaryLabels"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Dietary Labels"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. halal, pork_free, vegetarian"
                />
              )}
            />
          </View>

          <View>
            <Controller
              control={control}
              name="tasteTags"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Taste Tags"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. Spicy, Savoury, Wok Hei"
                />
              )}
            />
          </View>
        </View>

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Location & Hours
          </AppText>

          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="unitNumber"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Unit Number"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    placeholder="#01-12"
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="floor"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Floor"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    placeholder="Level 1"
                  />
                )}
              />
            </View>
          </View>

          <View>
            <Controller
              control={control}
              name="operatingHours"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Operating Hours"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. Mon-Sun 10:00-22:00"
                />
              )}
            />
          </View>

          <View>
            <Controller
              control={control}
              name="temporaryClosure"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Temporary Closure Notice"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. Closed for CNY until 15 Feb"
                />
              )}
            />
          </View>

          <Controller
            control={control}
            name="locationPrivacy"
            render={({ field: { onChange, value } }) => (
              <FormSwitchRow
                label="Requested exact location"
                description="Home-based publication remains unavailable pending server location privacy verification."
                value={value === "exact"}
                onValueChange={(val) => onChange(val ? "exact" : "hidden")}
              />
            )}
          />
        </View>

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Contact Info
          </AppText>

          <View>
            <Controller
              control={control}
              name="contactPhone"
              rules={{
                pattern: {
                  value: /^[89]\d{7}$/,
                  message: "Must be a valid 8-digit Singapore phone number starting with 8 or 9",
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Phone Number"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  keyboardType="phone-pad"
                  placeholder="e.g. 8123 4567"
                  error={Boolean(errors.contactPhone)}
                  errorText={errors.contactPhone?.message}
                />
              )}
            />
          </View>

          <View>
            <Controller
              control={control}
              name="contactEmail"
              rules={{
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Please enter a valid email address",
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email Address"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="e.g. hello@business.com"
                  error={Boolean(errors.contactEmail)}
                  errorText={errors.contactEmail?.message}
                />
              )}
            />
          </View>
        </View>

        <Button
          loading={isSubmitting}
          label={isSubmitting ? "Saving..." : "Save Profile"}
          variant="primary"
          fullWidth
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          style={{ marginTop: spacing[4] }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewButton: {
    borderWidth: 1,
  },
  verifiedBadge: {
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  photoPreview: {
    width: "100%",
    height: 140,
    borderWidth: 1,
  },
  photoPlaceholder: {
    height: 140,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
});
