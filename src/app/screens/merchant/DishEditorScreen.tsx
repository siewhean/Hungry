import React, { useState, useEffect } from "react";
import { Image, View, TextInput, StyleSheet, Alert, Switch, Pressable } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import { AppText, Button, Chip, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
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

function hasAvailabilityFlag(flags: readonly string[] | undefined, target: string): boolean {
  const normalizedTarget = target.toLowerCase().replace(/[\s-]+/g, "_");
  return (
    flags?.some((flag) => flag.toLowerCase().replace(/[\s-]+/g, "_") === normalizedTarget) ?? false
  );
}

export function DishEditorScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const dishId = route.params?.dishId;
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const repository = getDataRepository();
  const sampleImageUrl = activeOutlet?.signatureDishIds
    .map((signatureDishId) => repository.getDishById(signatureDishId)?.imageUrl)
    .find((candidate): candidate is string => Boolean(candidate));

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [dietaryFlags, setDietaryFlags] = useState<DietaryFlag[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    async function loadDish() {
      if (dishId) {
        try {
          const dish = await getHungryService().discovery.getDish(dishId);
          if (dish) {
            setName(dish.name);
            setPrice(dish.price.toString());
            setDescription(dish.description ?? "");
            setIngredients(dish.tasteTags.join(", "));
            setImageUrl(dish.imageUrl || dish.gallery?.[0] || "");
            setDietaryFlags(dish.dietaryFlags ?? []);
            setIsAvailable(!hasAvailabilityFlag(dish.availabilityFlags, "sold_out"));
            setIsFeatured(hasAvailabilityFlag(dish.availabilityFlags, "featured"));
          }
        } catch (e) {
          Alert.alert("Error", "Failed to load dish details.");
        }
      }
      setIsLoading(false);
    }
    void loadDish();
  }, [dishId]);

  const handleSave = async () => {
    if (!activeOutlet) return;
    if (!name.trim()) {
      Alert.alert("Validation", "Dish name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const parsedPrice = parseFloat(price) || 0;
      const trimmedImageUrl = imageUrl.trim();
      const updates: Partial<DishDetail> = {
        name: name.trim(),
        price: parsedPrice,
        priceRange: `S$${parsedPrice.toFixed(2)}`,
        description: description.trim(),
        imageUrl: trimmedImageUrl,
        gallery: trimmedImageUrl ? [trimmedImageUrl] : [],
        tasteTags: parseCommaSeparated(ingredients),
        dietaryFlags,
        availabilityFlags: [
          ...(!isAvailable ? ["sold_out"] : []),
          ...(isFeatured ? ["featured"] : []),
        ],
      };

      if (dishId) {
        await getHungryService().merchant.editDish(activeOutlet.id, dishId, updates);
      } else {
        await getHungryService().merchant.addDish(activeOutlet.id, updates);
      }

      Alert.alert("Success", `Dish ${dishId ? "updated" : "added"} successfully!`);
      navigation.goBack();
    } catch (e) {
      Alert.alert("Error", "Failed to save dish.");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!name) {
      Alert.alert("Notice", "Please enter a dish name first.");
      return;
    }
    const generated = await getHungryService().merchant.generateDishDescription(
      name,
      ingredients
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean),
    );
    setDescription(generated);
  };

  const handleSuggestIngredients = async () => {
    if (!name) {
      Alert.alert("Notice", "Please enter a dish name first.");
      return;
    }
    const suggestions = await getHungryService().merchant.suggestIngredients(name);
    setIngredients(suggestions.join(", "));
  };

  const handleSuggestAllergens = async () => {
    const ingredientList = parseCommaSeparated(ingredients);
    if (ingredientList.length === 0) {
      Alert.alert("Notice", "Add ingredients before running the allergen check.");
      return;
    }
    const allergens = await getHungryService().merchant.suggestAllergens(ingredientList);
    Alert.alert(
      "Ingredient check",
      allergens.length > 0
        ? `Detected: ${allergens.join(", ")}. Choose matching customer indicators below.`
        : "No common allergens detected from these ingredients.",
    );
  };

  const toggleDietaryFlag = (flag: DietaryFlag) => {
    setDietaryFlags((current) =>
      current.includes(flag) ? current.filter((item) => item !== flag) : [...current, flag],
    );
  };

  if (isLoading) {
    return (
      <Screen title="Loading...">
        <AppText>Fetching dish details...</AppText>
      </Screen>
    );
  }

  return (
    <Screen title={dishId ? "Edit Dish" : "Add Dish"}>
      <View style={{ gap: spacing[5], width: "100%" }}>
        <View>
          <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
            Dish Name *
          </AppText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Signature Wonton Mee"
            placeholderTextColor={palette.textMuted}
          />
        </View>

        <View>
          <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
            Price ($)
          </AppText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="e.g. 5.50"
            placeholderTextColor={palette.textMuted}
          />
        </View>

        <View>
          <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
            Dish Picture
          </AppText>
          {imageUrl.trim() ? (
            <Image source={{ uri: imageUrl.trim() }} style={styles.imagePreview} />
          ) : null}
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="Paste image URL or use the sample photo"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
          />
          <Button
            label="Use signature photo"
            variant="secondary"
            fullWidth={false}
            disabled={!sampleImageUrl}
            onPress={() => {
              if (sampleImageUrl) setImageUrl(sampleImageUrl);
            }}
            style={{ marginTop: spacing[2] }}
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
            <AppText variant="bodyBold">Ingredients</AppText>
            <Pressable
              onPress={handleSuggestIngredients}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Sparkles size={14} color={palette.orange} />
              <AppText variant="micro" style={{ color: palette.orange, fontWeight: "bold" }}>
                AI Suggest
              </AppText>
            </Pressable>
          </View>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={ingredients}
            onChangeText={setIngredients}
            placeholder="Comma separated (e.g. noodles, pork, wonton)"
            placeholderTextColor={palette.textMuted}
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
            Ingredient Indicators
          </AppText>
          <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[3] }}>
            Choose customer-facing labels for dietary needs and ingredient exclusions.
          </AppText>
          <View style={styles.chipWrap}>
            {DIETARY_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={dietaryFlags.includes(option.value)}
                onPress={() => toggleDietaryFlag(option.value)}
              />
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
            <AppText variant="bodyBold">Description</AppText>
            <Pressable
              onPress={handleGenerateDescription}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Sparkles size={14} color={palette.orange} />
              <AppText variant="micro" style={{ color: palette.orange, fontWeight: "bold" }}>
                AI Generate
              </AppText>
            </Pressable>
          </View>
          <TextInput
            style={[
              styles.input,
              {
                height: 100,
                textAlignVertical: "top",
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Describe your dish to make it sound appetizing..."
            placeholderTextColor={palette.textMuted}
          />
        </View>

        <View
          style={[
            styles.switchRow,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.md,
            },
          ]}
        >
          <View>
            <AppText variant="bodyBold">Available for sale</AppText>
            <AppText variant="bodySmall" tone="muted">
              Turn off to mark as Sold Out
            </AppText>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={setIsAvailable}
            trackColor={{ true: palette.success, false: palette.border }}
          />
        </View>

        <View
          style={[
            styles.switchRow,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.md,
            },
          ]}
        >
          <View>
            <AppText variant="bodyBold">Featured Dish</AppText>
            <AppText variant="bodySmall" tone="muted">
              Highlight at top of menu
            </AppText>
          </View>
          <Switch
            value={isFeatured}
            onValueChange={setIsFeatured}
            trackColor={{ true: palette.orange, false: palette.border }}
          />
        </View>

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
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
  },
  imagePreview: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
