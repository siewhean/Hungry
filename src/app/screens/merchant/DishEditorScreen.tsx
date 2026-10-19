import React, { useCallback, useState, useEffect } from "react";
import { View, StyleSheet, Alert, Pressable } from "react-native";
import { Camera, Sparkles, X } from "lucide-react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import { MerchantImageField } from "@/components/merchant/MerchantImageField";
import {
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
import {
  getDishSection,
  hasAvailabilityFlag,
  listMenuSections,
  withDishSection,
} from "@/features/merchant/menuSections";
import { ALLERGEN_CHECK_DISCLAIMER } from "@/features/merchant/allergenKeywords";
import { NEUTRAL_TASTE_VECTOR, TASTE_DIMENSIONS } from "@/constants/taste";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import type { DietaryFlag, DishDetail, TasteVector } from "@/types/domain";

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

const SUGGESTED_SECTIONS = ["Mains", "Sides", "Drinks", "Desserts", "Sets"];
const MAX_PRICE = 9999;

function parsePrice(value: string): number | null {
  const trimmed = value.replace(/^S?\$/i, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const price = Number(trimmed);
  return price > 0 && price <= MAX_PRICE ? price : null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function clampTasteValue(value: string): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.min(10, Math.max(0, Math.round(next)));
}

export function DishEditorScreen() {
  const { palette, spacing } = useHungryTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const dishId = route.params?.dishId;
  // A menu-scan draft is only published when the merchant saves the editor.
  const ocrDraftId = dishId ? undefined : route.params?.ocrDraftId;
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState("");
  // Menu-scan taste tags are kept as tags, not shown or saved as ingredients.
  const [draftTasteTags, setDraftTasteTags] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [originalImageUrl, setOriginalImageUrl] = useState("");
  const [section, setSection] = useState("");
  const [existingSections, setExistingSections] = useState<string[]>([]);
  const [otherFlags, setOtherFlags] = useState<string[]>([]);
  const [dietaryFlags, setDietaryFlags] = useState<DietaryFlag[]>([]);
  const [tasteVector, setTasteVector] = useState<TasteVector>({ ...NEUTRAL_TASTE_VECTOR });
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  const loadDish = useCallback(async () => {
    setError(null);
    if (!activeOutlet) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Read through the merchant menu: dishes that are not yet visible to diners
      // (pending verification) are still editable by their owner.
      const menu = await getHungryService().merchant.getMenu(activeOutlet.id);
      setExistingSections(listMenuSections(menu.map((item) => item.availabilityFlags)));
      if (ocrDraftId) {
        const drafts = await getHungryService().merchant.getOCRDrafts(activeOutlet.id);
        const draft = drafts.find((item) => item.id === ocrDraftId);
        if (draft) {
          setName(draft.name);
          setPrice(draft.price ? draft.price.toFixed(2) : "");
          setDescription(draft.suggestedDescription ?? "");
          setDraftTasteTags(draft.suggestedTasteTags ?? []);
          setDietaryFlags(draft.suggestedDietaryTags ?? []);
        }
        return;
      }
      if (!dishId) return;
      const dish =
        menu.find((item) => item.id === dishId) ??
        (await getHungryService().discovery.getDish(dishId));
      if (dish) {
        const dishImageUrl = dish.imageUrl || dish.gallery?.[0] || "";
        setName(dish.name);
        setPrice(dish.price ? dish.price.toFixed(2) : "");
        setDescription(dish.description ?? "");
        setIngredients(dish.tasteTags.join(", "));
        setImageUrl(dishImageUrl);
        setOriginalImageUrl(dishImageUrl);
        setSection(getDishSection(dish.availabilityFlags) ?? "");
        setOtherFlags(
          (dish.availabilityFlags ?? []).filter(
            (flag) =>
              !hasAvailabilityFlag([flag], "sold_out") && !hasAvailabilityFlag([flag], "featured"),
          ),
        );
        setDietaryFlags(dish.dietaryFlags ?? []);
        setTasteVector(dish.tasteVector ?? { ...NEUTRAL_TASTE_VECTOR });
        setIsAvailable(!hasAvailabilityFlag(dish.availabilityFlags, "sold_out"));
        setIsFeatured(hasAvailabilityFlag(dish.availabilityFlags, "featured"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dish details.");
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet, dishId, ocrDraftId]);

  useEffect(() => {
    void loadDish();
  }, [loadDish]);

  const handleSave = async () => {
    if (!activeOutlet) return;
    if (!name.trim()) {
      Alert.alert("Validation", "Dish name is required.");
      return;
    }
    const parsedPrice = parsePrice(price);
    if (parsedPrice === null) {
      Alert.alert("Validation", "Enter a price between S$0.01 and S$9,999, e.g. 5.50.");
      return;
    }

    setIsSaving(true);
    try {
      const trimmedImageUrl = imageUrl.trim();
      const imageChanged = trimmedImageUrl !== originalImageUrl;
      const updates: Partial<DishDetail> = {
        name: name.trim(),
        price: parsedPrice,
        priceRange: `S$${parsedPrice.toFixed(2)}`,
        description: description.trim(),
        // Only send the photo when it changed; an unchanged photo is already stored.
        ...(imageChanged || !dishId
          ? { imageUrl: trimmedImageUrl, gallery: trimmedImageUrl ? [trimmedImageUrl] : [] }
          : {}),
        tasteTags: Array.from(new Set([...draftTasteTags, ...parseCommaSeparated(ingredients)])),
        tasteVector,
        dietaryFlags,
        availabilityFlags: withDishSection(
          [
            ...otherFlags,
            ...(!isAvailable ? ["sold_out"] : []),
            ...(isFeatured ? ["featured"] : []),
          ],
          section,
        ),
      };

      if (dishId) {
        await getHungryService().merchant.editDish(activeOutlet.id, dishId, updates);
      } else if (ocrDraftId) {
        await getHungryService().merchant.acceptOCRDraft(ocrDraftId, updates);
      } else {
        await getHungryService().merchant.addDish(activeOutlet.id, updates);
      }

      Alert.alert(
        dishId ? "Dish updated" : "Dish added",
        activeOutlet.verification?.status === "verified"
          ? "Diners can see this change now."
          : "Saved. Diners will see your menu once Hungry verifies your stall.",
      );
      navigation.goBack();
    } catch (e) {
      Alert.alert("Could not save dish", errorMessage(e, "Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!name) {
      Alert.alert("Notice", "Please enter a dish name first.");
      return;
    }
    try {
      const generated = await getHungryService().merchant.generateDishDescription(
        name,
        parseCommaSeparated(ingredients),
      );
      setDescription(generated);
    } catch (e) {
      Alert.alert("Suggestion unavailable", errorMessage(e, "Please try again."));
    }
  };

  const handleSuggestIngredients = async () => {
    if (!name) {
      Alert.alert("Notice", "Please enter a dish name first.");
      return;
    }
    try {
      const suggestions = await getHungryService().merchant.suggestIngredients(name);
      setIngredients((current) =>
        Array.from(new Set([...parseCommaSeparated(current), ...suggestions])).join(", "),
      );
    } catch (e) {
      Alert.alert("Suggestion unavailable", errorMessage(e, "Please try again."));
    }
  };

  const handleSuggestTags = async () => {
    if (!name) {
      Alert.alert("Notice", "Please enter a dish name first.");
      return;
    }
    try {
      const suggestions = await getHungryService().merchant.suggestTags(name, description);
      // Merge rather than overwrite so typed ingredients are kept.
      setIngredients((current) =>
        Array.from(new Set([...parseCommaSeparated(current), ...suggestions])).join(", "),
      );
    } catch (e) {
      Alert.alert("Suggestion unavailable", errorMessage(e, "Please try again."));
    }
  };

  const handleSuggestAllergens = async () => {
    const ingredientList = parseCommaSeparated(ingredients);
    if (ingredientList.length === 0) {
      Alert.alert("Notice", "Add ingredients before running the allergen check.");
      return;
    }
    let allergens: string[];
    try {
      allergens = await getHungryService().merchant.suggestAllergens(ingredientList);
    } catch (e) {
      Alert.alert("Check unavailable", errorMessage(e, "Please try again."));
      return;
    }
    Alert.alert(
      "Ingredient check",
      allergens.length > 0
        ? `Possible allergens: ${allergens.join(", ")}. ${ALLERGEN_CHECK_DISCLAIMER}`
        : `No allergen keywords matched. That does not mean the dish is allergen-free. ${ALLERGEN_CHECK_DISCLAIMER}`,
    );
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
            label="Price (S$) *"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="e.g. 5.50"
          />
        </View>

        <MerchantImageField
          label="Dish Photo"
          value={imageUrl}
          onChange={setImageUrl}
          isSaving={isSaving}
          icon={<Camera size={24} color={palette.textMuted} />}
        />

        <View>
          <Input
            label="Menu Section"
            value={section}
            onChangeText={setSection}
            maxLength={32}
            placeholder="e.g. Noodles, Drinks"
          />
          <View style={{ marginTop: spacing[2] }}>
            <ChipGroup
              options={Array.from(new Set([...existingSections, ...SUGGESTED_SECTIONS])).map(
                (option) => ({ id: option, label: option }),
              )}
              selectedIds={section ? [section] : []}
              onSelect={(option) => setSection((current) => (current === option ? "" : option))}
            />
          </View>
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
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing[2],
            }}
          >
            <AppText variant="bodyBold">Ingredients & Tags</AppText>
            <Pressable
              onPress={handleSuggestIngredients}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Sparkles size={14} color={palette.orange} />
              <AppText variant="micro" style={{ color: palette.orange, fontWeight: "bold" }}>
                Suggest
              </AppText>
            </Pressable>
          </View>
          <Input
            value={ingredients}
            onChangeText={setIngredients}
            placeholder="Comma separated (e.g. noodles, pork, wonton)"
            multiline
          />
          <Button
            label="Check ingredient indicators"
            variant="secondary"
            fullWidth={false}
            onPress={handleSuggestAllergens}
            style={{ marginTop: spacing[2] }}
          />
          <Button
            label="Suggest taste tags"
            variant="secondary"
            fullWidth={false}
            onPress={handleSuggestTags}
            style={{ marginTop: spacing[2] }}
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
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing[2],
            }}
          >
            <AppText variant="bodyBold">Description</AppText>
            <Pressable
              onPress={handleGenerateDescription}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Sparkles size={14} color={palette.orange} />
              <AppText variant="micro" style={{ color: palette.orange, fontWeight: "bold" }}>
                Draft description
              </AppText>
            </Pressable>
          </View>
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
});
