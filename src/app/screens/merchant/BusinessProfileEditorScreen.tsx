import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Camera, Image as ImageIcon } from "lucide-react-native";
import { useForm, Controller } from "react-hook-form";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppText, Button, Screen, Chip } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import type { MerchantOutlet, LocationPrivacy } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

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
  contactPhone: string;
  contactEmail: string;
  dietaryLabels: string;
  tasteTags: string;
};

export function BusinessProfileEditorScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const rootNavigation = getRootNavigation(navigation as any);
  const repository = getDataRepository();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const updateOutletProfile = useMerchantStore((state) => state.updateOutletProfile);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting, errors },
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
      contactPhone: "",
      contactEmail: "",
      dietaryLabels: "",
      tasteTags: "",
    },
  });

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
      setValue("contactPhone", activeOutlet.contactPhone || "");
      setValue("contactEmail", activeOutlet.contactEmail || "");
      setValue("dietaryLabels", activeOutlet.dietaryLabels?.join(", ") || "");
      setValue("tasteTags", activeOutlet.tasteTags?.join(", ") || "");
    }
  }, [activeOutlet, setValue]);

  const onSubmit = async (data: FormData) => {
    if (!activeOutlet) return;
    try {
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
      updateOutletProfile(activeOutlet.id, updated);
      Alert.alert("Success", "Profile updated successfully!");
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update profile.");
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
    const fallbackVenueId = activeOutlet.buildingId
      ? repository.listVenuesByBuilding(activeOutlet.buildingId)[0]?.id
      : undefined;
    const venueId = signatureVenueId ?? fallbackVenueId;

    if (venueId) {
      rootNavigation.navigate("StallDetail", { venueId });
    } else {
      rootNavigation.navigate("DiscoverMap");
    }
  };

  if (!activeOutlet) {
    return (
      <Screen title="Error">
        <AppText>No active outlet selected.</AppText>
      </Screen>
    );
  }

  return (
    <Screen
      title="Business Profile"
      headerRight={
        <TouchableOpacity
          onPress={handlePreviewAsCustomer}
          style={[
            styles.previewButton, { paddingVertical: spacing[1], paddingHorizontal: spacing[3], borderRadius: radii.pill },
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
              styles.verifiedBadge, { paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radii.md },
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
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Business Name *
            </AppText>
            <Controller
              control={control}
              name="name"
              rules={{ required: "Name is required" }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[
                    styles.input, { borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                    errors.name && { borderColor: palette.error },
                  ]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. Uncle Tan's Chicken Rice"
                  placeholderTextColor={palette.textMuted}
                />
              )}
            />
            {errors.name && (
              <AppText variant="micro" style={{ color: palette.error, marginTop: 4 }}>
                {errors.name.message}
              </AppText>
            )}
          </View>

          <View>
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Description
            </AppText>
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[
                    styles.input, { borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
                    styles.textArea, { height: 100 },
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  multiline
                  numberOfLines={4}
                  placeholder="Tell customers about your business..."
                  placeholderTextColor={palette.textMuted}
                />
              )}
            />
          </View>

          <View>
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Business Type
            </AppText>
            <Controller
              control={control}
              name="businessType"
              render={({ field: { onChange, value } }) => (
                <View style={[styles.pickerContainer, { gap: spacing[2], marginTop: spacing[1] }]}>
                  {[
                    "hawker_stall",
                    "food_court_stall",
                    "restaurant",
                    "cafe",
                    "mall_tenant",
                    "home_based",
                  ].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.pickerChip, { paddingVertical: spacing[1], paddingHorizontal: spacing[3], borderRadius: radii.pill },
                        { backgroundColor: palette.bgSoft, borderColor: palette.border },
                        value === type && {
                          backgroundColor: palette.orangeLight,
                          borderColor: palette.orange,
                        },
                      ]}
                      onPress={() => onChange(type)}
                    >
                      <AppText
                        variant="bodySmallBold"
                        style={{ color: value === type ? palette.orange : palette.textMuted }}
                      >
                        {type.replace("_", " ")}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </View>
        </View>

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Photos
          </AppText>
          <View style={{ flexDirection: "row", gap: spacing[4] }}>
            <View style={{ flex: 1, gap: spacing[2] }}>
              <AppText variant="bodyBold">Profile Image</AppText>
              <TouchableOpacity
                style={{
                  height: 100,
                  backgroundColor: palette.bgSoft,
                  borderColor: palette.border,
                  borderWidth: 1,
                  borderRadius: radii.xl,
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={() => Alert.alert("Upload", "Photo upload coming soon")}
              >
                <Camera size={24} color={palette.textMuted} />
                <AppText variant="micro" tone="muted" style={{ marginTop: 4 }}>Add Photo</AppText>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, gap: spacing[2] }}>
              <AppText variant="bodyBold">Cover Image</AppText>
              <TouchableOpacity
                style={{
                  height: 100,
                  backgroundColor: palette.bgSoft,
                  borderColor: palette.border,
                  borderWidth: 1,
                  borderRadius: radii.xl,
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={() => Alert.alert("Upload", "Cover upload coming soon")}
              >
                <ImageIcon size={24} color={palette.textMuted} />
                <AppText variant="micro" tone="muted" style={{ marginTop: 4 }}>Add Cover</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Tags & Categories
          </AppText>

          <View>
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Cuisine Categories
            </AppText>
            <Controller
              control={control}
              name="cuisineCategories"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[
                    styles.input, { borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. Chinese, Noodles (comma-separated)"
                  placeholderTextColor={palette.textMuted}
                />
              )}
            />
          </View>

          <View>
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Dietary Labels
            </AppText>
            <Controller
              control={control}
              name="dietaryLabels"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[
                    styles.input, { borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. halal, pork_free, vegetarian"
                  placeholderTextColor={palette.textMuted}
                />
              )}
            />
          </View>

          <View>
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Taste Tags
            </AppText>
            <Controller
              control={control}
              name="tasteTags"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[
                    styles.input, { borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. Spicy, Savoury, Wok Hei"
                  placeholderTextColor={palette.textMuted}
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
              <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
                Unit Number
              </AppText>
              <Controller
                control={control}
                name="unitNumber"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input, { borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                        color: palette.text,
                      },
                    ]}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    placeholder="#01-12"
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
                Floor
              </AppText>
              <Controller
                control={control}
                name="floor"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input, { borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                        color: palette.text,
                      },
                    ]}
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
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Operating Hours
            </AppText>
            <Controller
              control={control}
              name="operatingHours"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[
                    styles.input, { borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. Mon-Sun 10:00-22:00"
                />
              )}
            />
          </View>

          <View>
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Temporary Closure Notice
            </AppText>
            <Controller
              control={control}
              name="temporaryClosure"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[
                    styles.input, { borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. Closed for CNY until 15 Feb"
                  placeholderTextColor={palette.textMuted}
                />
              )}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing[2] }}>
            <View style={{ flex: 1, paddingRight: spacing[4] }}>
              <AppText variant="bodyBold">Exact Location Privacy</AppText>
              <AppText variant="micro" tone="muted">
                Turn off to hide your exact unit number and floor (useful for home-based businesses).
              </AppText>
            </View>
            <Controller
              control={control}
              name="locationPrivacy"
              render={({ field: { onChange, value } }) => (
                <Switch
                  value={value === "exact"}
                  onValueChange={(val) => onChange(val ? "exact" : "hidden")}
                  trackColor={{ false: palette.border, true: palette.orange }}
                />
              )}
            />
          </View>
        </View>

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Contact Info
          </AppText>

          <View>
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Phone Number
            </AppText>
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
                <View>
                  <TextInput
                    style={[
                      styles.input, { borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
                      {
                        backgroundColor: palette.surface,
                        borderColor: errors.contactPhone ? palette.error : palette.border,
                        color: palette.text,
                      },
                    ]}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    keyboardType="phone-pad"
                    placeholder="e.g. 8123 4567"
                    placeholderTextColor={palette.textMuted}
                  />
                  {errors.contactPhone && (
                    <AppText variant="micro" style={{ color: palette.error, marginTop: spacing[1] }}>
                      {errors.contactPhone.message}
                    </AppText>
                  )}
                </View>
              )}
            />
          </View>

          <View>
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Email Address
            </AppText>
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
                <View>
                  <TextInput
                    style={[
                      styles.input, { borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
                      {
                        backgroundColor: palette.surface,
                        borderColor: errors.contactEmail ? palette.error : palette.border,
                        color: palette.text,
                      },
                    ]}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="e.g. hello@business.com"
                    placeholderTextColor={palette.textMuted}
                  />
                  {errors.contactEmail && (
                    <AppText variant="micro" style={{ color: palette.error, marginTop: spacing[1] }}>
                      {errors.contactEmail.message}
                    </AppText>
                  )}
                </View>
              )}
            />
          </View>
        </View>

        <Button
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
  input: {
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    textAlignVertical: "top",
  },
  pickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  pickerChip: {
    borderWidth: 1,
  },
});
