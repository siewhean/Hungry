import { useMerchantOperationScope } from "@/features/merchant/useMerchantOperationScope";
import { useRef as useMerchantRequestRef } from "react";
import React, { useCallback, useState, useEffect, useRef } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { X } from "lucide-react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";

import {
  AccessibleImage,
  AppText,
  Button,
  ChipGroup,
  EmptyState,
  FormSwitchRow,
  Input,
  Screen,
} from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { NEUTRAL_TASTE_VECTOR, TASTE_DIMENSIONS } from "@/constants/taste";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import type { DietaryFlag, DishDetail, TasteVector } from "@/types/domain";

import { parseMerchantPrice, updateMerchantAvailability } from "@/features/merchant/workflowSafety";
import { useMerchantDirtyExit } from "@/features/merchant/useMerchantDirtyExit";

type RouteProps = RouteProp<MerchantTabParamList, "DishEditor">;

const DIETARY_OPTIONS: { label: string; value: DietaryFlag }[] = [
  { label: "Halal", value: "halal" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Vegan", value: "vegan" },
  { label: "Pork-free", value: "pork_free" },
  { label: "Nut-free", value: "nut_free" },
  { label: "Gluten-free", value: "gluten_free" },
  { label: "Dairy-free", value: "dairy_free" },
  { label: "Shellfish-free", value: "shellfish_free" },
];

function parseCommaSeparated(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function hasAvailabilityFlag(flags: readonly string[] | undefined, target: string): boolean {
  const normalizedTarget = target.toLowerCase().replace(/[\s-]+/g, "_");
  return (
    flags?.some((flag) => flag.toLowerCase().replace(/[\s-]+/g, "_") === normalizedTarget) ?? false
  );
}

function clampTasteValue(value: string): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.min(10, Math.max(0, Math.round(next)));
}

export function DishEditorScreen() {
  const captureOperation = useMerchantOperationScope();

  const { componentRadii, palette, spacing } = useHungryTheme();
  const route = useRoute<RouteProps>();
  const dishId = route.params?.dishId;
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => setIsSaving(false), [activeOutlet?.id]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [dietaryFlags, setDietaryFlags] = useState<DietaryFlag[]>([]);
  const [tasteVector, setTasteVector] = useState<TasteVector>({ ...NEUTRAL_TASTE_VECTOR });
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  const [originalGallery, setOriginalGallery] = useState<string[]>([]);
  const [originalImage, setOriginalImage] = useState("");
  const [originalFlags, setOriginalFlags] = useState<string[]>([]);
  const baseline = useRef<string | null>(null);
  const snapshot = JSON.stringify({
    name,
    price,
    description,
    ingredients,
    imageUrl,
    dietaryFlags,
    tasteVector,
    isAvailable,
    isFeatured,
  });
  useEffect(() => {
    if (!isLoading && baseline.current === null) baseline.current = snapshot;
  }, [isLoading, snapshot]);
  const finishBack = useMerchantDirtyExit(
    baseline.current !== null && baseline.current !== snapshot,
    isSaving,
  );

  const requestGeneration = useMerchantRequestRef(0);
  const currentOutlet = useMerchantRequestRef(activeOutlet?.id);
  currentOutlet.current = activeOutlet?.id;
  const loadDish = useCallback(async () => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    const request = ++requestGeneration.current;
    const outletId = activeOutlet?.id;
    const isCurrent = () =>
      request === requestGeneration.current && outletId === currentOutlet.current;
    setError(null);
    if (!dishId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const dish = await getHungryService().discovery.getDish(dishId);
      if (!isOperationCurrent()) return;

      if (!isCurrent()) return;
      if (dish) {
        setOriginalGallery(dish.gallery ?? []);
        setOriginalImage(dish.imageUrl);
        setOriginalFlags(dish.availabilityFlags ?? []);
        setName(dish.name);
        setPrice(dish.price.toString());
        setDescription(dish.description ?? "");
        setIngredients(dish.tasteTags.join(", "));
        setImageUrl(dish.imageUrl || dish.gallery?.[0] || "");
        setDietaryFlags(dish.dietaryFlags ?? []);
        setTasteVector(dish.tasteVector ?? { ...NEUTRAL_TASTE_VECTOR });
        setIsAvailable(!hasAvailabilityFlag(dish.availabilityFlags, "sold_out"));
        setIsFeatured(hasAvailabilityFlag(dish.availabilityFlags, "featured"));
      } else {
        throw new Error("This dish is unavailable.");
      }
    } catch (e) {
      if (!isOperationCurrent()) return;

      if (!isCurrent()) return;
      setError(e instanceof Error ? e.message : "Failed to load dish details.");
    } finally {
      if (isOperationCurrent()) {
        if (isCurrent()) setIsLoading(false);
      }
    }
  }, [dishId]);

  useEffect(() => {
    void loadDish();
  }, [loadDish]);

  const handleSave = async () => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    if (!activeOutlet || isSaving) return;
    if (!name.trim()) {
      Alert.alert("Validation", "Dish name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const parsedPrice = parseMerchantPrice(price);
      const trimmedImageUrl = imageUrl.trim();
      const updates: Partial<DishDetail> = {
        name: name.trim(),
        price: parsedPrice,
        priceRange: `S$${parsedPrice.toFixed(2)}`,
        description: description.trim(),
        imageUrl: trimmedImageUrl,
        gallery: Array.from(
          new Set([
            ...(trimmedImageUrl ? [trimmedImageUrl] : []),
            ...originalGallery.filter((url) => url !== originalImage),
          ]),
        ),
        tasteTags: parseCommaSeparated(ingredients),
        tasteVector,
        dietaryFlags,
        availabilityFlags: updateMerchantAvailability(originalFlags, isAvailable, isFeatured),
      };

      if (dishId) {
        await getHungryService().merchant.editDish(activeOutlet.id, dishId, updates);
        if (!isOperationCurrent()) return;
      } else {
        await getHungryService().merchant.addDish(activeOutlet.id, updates);
        if (!isOperationCurrent()) return;
      }

      Alert.alert("Success", `Dish ${dishId ? "updated" : "added"} successfully!`);
      baseline.current = snapshot;
      finishBack();
    } catch (e) {
      if (!isOperationCurrent()) return;

      Alert.alert(
        "Could not save dish",
        e instanceof Error ? e.message : "Please retry. Your changes are preserved.",
      );
    } finally {
      if (isOperationCurrent()) {
        setIsSaving(false);
      }
    }
  };

  const toggleDietaryFlag = (flag: DietaryFlag) => {
    setDietaryFlags((current) =>
      current.includes(flag) ? current.filter((item) => item !== flag) : [...current, flag],
    );
  };

  const handleTasteVectorChange = (key: keyof TasteVector, value: string) => {
    setTasteVector((current) => ({ ...current, [key]: clampTasteValue(value) }));
  };

  if (isLoading) {
    return (
      <Screen title="Loading...">
        <AppText>Fetching dish details...</AppText>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Error">
        <EmptyState
          title="Failed to load dish"
          body="Your dish details could not be loaded."
          icon={<X size={40} color={palette.error} />}
          errorMessage={error}
          sendErrorContext="Dish editor"
          ctaLabel="Retry"
          onPress={loadDish}
        />
      </Screen>
    );
  }

  return (
    <Screen title={dishId ? "Edit Dish" : "Add Dish"}>
      <View style={{ gap: spacing[5], width: "100%" }}>
        <View>
          <Input
            label="Dish Name *"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Signature Wonton Mee"
          />
        </View>

        <View>
          <Input
            label="Price ($)"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="e.g. 5.50"
          />
        </View>

        <View>
          <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
            Dish Picture
          </AppText>
          {imageUrl.trim() ? (
            <AccessibleImage
              source={{ uri: imageUrl.trim() }}
              style={[
                styles.imagePreview,
                { borderRadius: componentRadii.card, marginBottom: spacing[3] },
              ]}
              accessibilityLabel="Dish picture preview"
            />
          ) : null}
          <Button
            label="Choose dish photo"
            variant="secondary"
            fullWidth={false}
            onPress={async () => {
              const isOperationCurrent = captureOperation();
              if (!isOperationCurrent()) return;

              try {
                const picker = await import("expo-image-picker");
                if (!isOperationCurrent()) return;

                const permission = await picker.requestMediaLibraryPermissionsAsync();
                if (!isOperationCurrent()) return;

                if (!permission.granted) {
                  Alert.alert("Photo access needed", "Allow photo access to choose a dish photo.");
                  return;
                }
                const result = await picker.launchImageLibraryAsync({
                  mediaTypes: ["images"],
                  quality: 0.85,
                });
                if (!isOperationCurrent()) return;

                if (!result.canceled && result.assets[0]) setImageUrl(result.assets[0].uri);
              } catch (error) {
                if (!isOperationCurrent()) return;

                Alert.alert(
                  "Cannot open photos",
                  error instanceof Error ? error.message : "Please retry.",
                );
              }
            }}
          />
          {imageUrl ? (
            <Button label="Remove dish photo" variant="ghost" onPress={() => setImageUrl("")} />
          ) : null}
        </View>

        <View>
          <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
            Taste Profile
          </AppText>
          <View style={[styles.tasteGrid, { gap: spacing[2] }]}>
            {TASTE_DIMENSIONS.map((dimension) => (
              <View key={dimension.key} style={{ flexBasis: "31%", flexGrow: 1 }}>
                <Input
                  label={dimension.label}
                  value={String(tasteVector[dimension.key])}
                  onChangeText={(value) => handleTasteVectorChange(dimension.key, value)}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="0-10"
                />
              </View>
            ))}
          </View>
        </View>

        <View>
          <AppText variant="bodyBold">Taste tags</AppText>
          <Input
            value={ingredients}
            onChangeText={setIngredients}
            placeholder="Comma separated (e.g. savoury, aromatic)"
            multiline
          />
        </View>

        <View>
          <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
            Ingredient Indicators
          </AppText>
          <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[3] }}>
            Choose customer-facing labels for dietary needs and ingredient exclusions.
          </AppText>
          <ChipGroup
            options={DIETARY_OPTIONS.map((option) => ({
              id: option.value,
              label: option.label,
            }))}
            selectedIds={dietaryFlags}
            onSelect={toggleDietaryFlag}
          />
        </View>

        <View>
          <AppText variant="bodyBold">Description</AppText>
          <Input
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Describe your dish to make it sound appetizing..."
            style={{ minHeight: 100, textAlignVertical: "top" }}
          />
        </View>

        <FormSwitchRow
          label="Available for sale"
          description="Turn off to mark as Sold Out"
          value={isAvailable}
          onValueChange={setIsAvailable}
        />

        <FormSwitchRow
          label="Featured Dish"
          description="Highlight at top of menu"
          value={isFeatured}
          onValueChange={setIsFeatured}
        />

        <Button
          loading={isSaving}
          label={isSaving ? "Saving..." : "Save Dish"}
          variant="primary"
          fullWidth
          onPress={handleSave}
          disabled={isSaving}
          style={{ marginTop: spacing[4] }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tasteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  imagePreview: {
    width: "100%",
    height: 180,
  },
});
