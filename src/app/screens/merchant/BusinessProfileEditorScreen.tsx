import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
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
            styles.previewButton,
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
                    styles.input,
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
                    styles.input,
                    styles.textArea,
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
                <View style={styles.pickerContainer}>
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
                        styles.pickerChip,
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
                      styles.input,
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
                      styles.input,
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
                    styles.input,
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  verifiedBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  pickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  pickerChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
});
