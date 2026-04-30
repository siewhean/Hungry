import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MerchantTabParamList } from "../../navigation/navigationTypes";
import { useMerchantStore, getActiveOutlet } from "../../../store/useMerchantStore";
import { hungryService } from "../../../lib/services/mock/mockService";
import type { MerchantOutlet, LocationPrivacy } from "../../../types/domain";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const navigation = useNavigation<NavigationProp>();
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

      const updated = await hungryService.merchant.updateBusinessProfile(activeOutlet.id, updates);
      updateOutletProfile(activeOutlet.id, updated);
      Alert.alert("Success", "Profile updated successfully!");
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update profile.");
    }
  };

  const handlePreviewAsCustomer = () => {
    if (activeOutlet?.buildingId) {
      // Navigation could go to StallDetail but we need stall ID
      Alert.alert("Preview mode", "Navigating to customer preview...");
    } else {
      Alert.alert("Notice", "Save your profile first to preview.");
    }
  };

  if (!activeOutlet) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>No active outlet selected.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Business Profile</Text>
          <TouchableOpacity onPress={handlePreviewAsCustomer} style={styles.previewButton}>
            <Text style={styles.previewButtonText}>Preview as Customer</Text>
          </TouchableOpacity>
        </View>

        {activeOutlet.verification?.status === "verified" && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>✓ Verified by Hungry</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Basic Info</Text>

        <Text style={styles.label}>Business Name *</Text>
        <Controller
          control={control}
          name="name"
          rules={{ required: "Name is required" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="e.g. Uncle Tan's Chicken Rice"
            />
          )}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}

        <Text style={styles.label}>Description</Text>
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, styles.textArea]}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              multiline
              numberOfLines={4}
              placeholder="Tell customers about your business..."
            />
          )}
        />

        <Text style={styles.label}>Business Type</Text>
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
                  style={[styles.pickerChip, value === type && styles.pickerChipActive]}
                  onPress={() => onChange(type)}
                >
                  <Text
                    style={[styles.pickerChipText, value === type && styles.pickerChipTextActive]}
                  >
                    {type.replace("_", " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />

        <Text style={styles.label}>Cuisine Categories (comma separated)</Text>
        <Controller
          control={control}
          name="cuisineCategories"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="e.g. Chinese, Local, Noodles"
            />
          )}
        />

        <Text style={styles.sectionTitle}>Location & Hours</Text>

        <Text style={styles.label}>Unit Number</Text>
        <Controller
          control={control}
          name="unitNumber"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="e.g. #01-12"
            />
          )}
        />

        <Text style={styles.label}>Floor</Text>
        <Controller
          control={control}
          name="floor"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="e.g. Level 1"
            />
          )}
        />

        <Text style={styles.label}>Location Privacy</Text>
        <Controller
          control={control}
          name="locationPrivacy"
          render={({ field: { onChange, value } }) => (
            <View style={styles.pickerContainer}>
              {["exact", "approximate", "hidden"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.pickerChip, value === type && styles.pickerChipActive]}
                  onPress={() => onChange(type)}
                >
                  <Text
                    style={[styles.pickerChipText, value === type && styles.pickerChipTextActive]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />

        <Text style={styles.label}>Operating Hours</Text>
        <Controller
          control={control}
          name="operatingHours"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="e.g. Mon-Sun 10:00-22:00"
            />
          )}
        />

        <Text style={styles.label}>Temporary Closure Notice</Text>
        <Controller
          control={control}
          name="temporaryClosure"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="e.g. Closed for CNY until 15 Feb"
            />
          )}
        />

        <Text style={styles.sectionTitle}>Contact Info</Text>

        <Text style={styles.label}>Phone Number</Text>
        <Controller
          control={control}
          name="contactPhone"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              keyboardType="phone-pad"
              placeholder="e.g. +65 9123 4567"
            />
          )}
        />

        <Text style={styles.label}>Email Address</Text>
        <Controller
          control={control}
          name="contactEmail"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="e.g. hello@business.com"
            />
          )}
        />

        <Text style={styles.sectionTitle}>Attributes</Text>

        <Text style={styles.label}>Dietary Labels (comma separated)</Text>
        <Controller
          control={control}
          name="dietaryLabels"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="e.g. halal, vegetarian, nut_free"
            />
          )}
        />

        <Text style={styles.label}>Taste/Cuisine Tags (comma separated)</Text>
        <Controller
          control={control}
          name="tasteTags"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="e.g. spicy, wok_hei, comfort_food"
            />
          )}
        />

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            <Text style={styles.saveButtonText}>{isSubmitting ? "Saving..." : "Save Profile"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  previewButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  previewButtonText: {
    fontSize: 14,
    color: "#4B5563",
    fontWeight: "500",
  },
  verifiedBadge: {
    backgroundColor: "#ECFDF5",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#10B981",
    alignSelf: "flex-start",
  },
  verifiedText: {
    color: "#059669",
    fontWeight: "bold",
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4B5563",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
  },
  inputError: {
    borderColor: "#EF4444",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
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
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pickerChipActive: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },
  pickerChipText: {
    fontSize: 14,
    color: "#4B5563",
  },
  pickerChipTextActive: {
    color: "#B45309",
    fontWeight: "500",
  },
  footer: {
    marginTop: 32,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: "#F97316",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#FDBA74",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
