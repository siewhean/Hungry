import React, { useCallback, useState, useEffect, useMemo } from "react";
import { View, Alert, Pressable } from "react-native";
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
  Skeleton,
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
import { createMerchantDishId, trackMerchantEvent } from "@/features/merchant/merchantTracking";
import { useUnsavedChangesGuard } from "@/features/merchant/useUnsavedChangesGuard";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import type { DietaryFlag, DishDetail } from "@/types/domain";

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

const AI_LINK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

export function DishEditorScreen() {
  const { palette, spacing, radii } = useHungryTheme();
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
  // Ingredients only feed the AI suggestions and the allergen check; they are never saved.
  const [ingredients, setIngredients] = useState("");
  // Diner-facing tags, saved as the dish's taste tags.
  const [tags, setTags] = useState("");
  // Made once per editor: a retried "Add" saves the dish the first attempt created.
  const [newDishId] = useState(createMerchantDishId);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [originalImageUrl, setOriginalImageUrl] = useState("");
  const [section, setSection] = useState("");
  const [existingSections, setExistingSections] = useState<string[]>([]);
  const [otherFlags, setOtherFlags] = useState<string[]>([]);
  const [dietaryFlags, setDietaryFlags] = useState<DietaryFlag[]>([]);
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
          setTags((draft.suggestedTasteTags ?? []).join(", "));
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
        setTags(dish.tasteTags.join(", "));
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

  const formSnapshot = useMemo(
    () =>
      JSON.stringify([
        name,
        price,
        description,
        tags,
        imageUrl,
        section,
        dietaryFlags,
        isAvailable,
        isFeatured,
      ]),
    [name, price, description, tags, imageUrl, section, dietaryFlags, isAvailable, isFeatured],
  );
  // The first snapshot after loading is the saved state; anything else is an unsaved edit.
  useEffect(() => {
    if (!isLoading && savedSnapshot === null) setSavedSnapshot(formSnapshot);
  }, [formSnapshot, isLoading, savedSnapshot]);
  const isDirty = savedSnapshot !== null && savedSnapshot !== formSnapshot && !isSaving;
  const leaveEditor = useCallback(() => navigation.goBack(), [navigation]);
  const confirmLeave = useUnsavedChangesGuard(isDirty, leaveEditor);

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
        tasteTags: parseCommaSeparated(tags),
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
        trackMerchantEvent("merchant_dish_updated", activeOutlet.id);
      } else if (ocrDraftId) {
        await getHungryService().merchant.acceptOCRDraft(ocrDraftId, updates);
        trackMerchantEvent("merchant_ocr_draft_accepted", activeOutlet.id, { edited: true });
      } else {
        await getHungryService().merchant.addDish(activeOutlet.id, { ...updates, id: newDishId });
        trackMerchantEvent("merchant_dish_created", activeOutlet.id, {
          has_photo: Boolean(trimmedImageUrl),
        });
      }
      setSavedSnapshot(formSnapshot);

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

  const handleDelete = () => {
    if (!activeOutlet || !dishId) return;
    Alert.alert("Delete Dish", `Are you sure you want to delete ${name || "this dish"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setIsSaving(true);
          try {
            await getHungryService().merchant.deleteDish(activeOutlet.id, dishId);
            trackMerchantEvent("merchant_dish_deleted", activeOutlet.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert("Could not delete dish", errorMessage(e, "Please try again."));
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
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
      trackMerchantEvent("merchant_ai_suggestion_used", activeOutlet?.id, { kind: "description" });
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
      trackMerchantEvent("merchant_ai_suggestion_used", activeOutlet?.id, { kind: "ingredients" });
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
      // Merge rather than overwrite so typed tags are kept.
      setTags((current) =>
        Array.from(new Set([...parseCommaSeparated(current), ...suggestions])).join(", "),
      );
      trackMerchantEvent("merchant_ai_suggestion_used", activeOutlet?.id, { kind: "tags" });
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

  if (isLoading) {
    return (
      <Screen title={dishId ? "Edit Dish" : "Add Dish"}>
        <View accessibilityLabel="Loading dish details" style={{ gap: spacing[4], width: "100%" }}>
          <Skeleton height={56} borderRadius={radii.lg} />
          <Skeleton height={56} borderRadius={radii.lg} />
          <Skeleton height={160} borderRadius={radii.lg} />
          <Skeleton height={56} borderRadius={radii.lg} />
        </View>
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
    <Screen title={dishId ? "Edit Dish" : "Add Dish"} onBackPress={confirmLeave}>
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
          rationale="Hungry needs access to your photo library to add a photo of this dish."
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
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing[2],
            }}
          >
            <AppText variant="bodyBold">Ingredients</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Suggest ingredients"
              hitSlop={AI_LINK_HIT_SLOP}
              onPress={handleSuggestIngredients}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44 }}
            >
              <Sparkles size={14} color={palette.orange} />
              <AppText variant="micro" style={{ color: palette.orange, fontWeight: "bold" }}>
                Suggest
              </AppText>
            </Pressable>
          </View>
          <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[2] }}>
            Used for suggestions and the allergen check only. Not shown to diners.
          </AppText>
          <Input
            accessibilityLabel="Ingredients"
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
        </View>

        <View>
          <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
            Tags
          </AppText>
          <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[2] }}>
            Shown to diners on the dish, e.g. spicy, comfort food.
          </AppText>
          <Input
            accessibilityLabel="Tags"
            value={tags}
            onChangeText={setTags}
            placeholder="Comma separated (e.g. spicy, springy noodles)"
            multiline
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
              accessibilityRole="button"
              accessibilityLabel="Draft description"
              hitSlop={AI_LINK_HIT_SLOP}
              onPress={handleGenerateDescription}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44 }}
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
        {dishId ? (
          <Button
            label="Delete Dish"
            variant="destructive"
            fullWidth
            onPress={handleDelete}
            disabled={isSaving}
          />
        ) : null}
      </View>
    </Screen>
  );
}
