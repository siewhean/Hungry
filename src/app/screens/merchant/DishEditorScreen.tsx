import React, { useState, useEffect } from "react";
import { View, ScrollView, TextInput, StyleSheet, Alert, Switch, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Sparkles } from "lucide-react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";

import { AppText, Button, IconButton, Screen, Chip } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { hungryService } from "@/lib/services/mock/mockService";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

type RouteProps = RouteProp<MerchantTabParamList, "DishEditor">;

export function DishEditorScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const dishId = route.params?.dishId;
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    async function loadDish() {
      if (dishId) {
        try {
          const dish = await hungryService.discovery.getDish(dishId);
          if (dish) {
            setName(dish.name);
            setPrice(dish.price.toString());
            setDescription(dish.tasteTags.join(", ")); // Using taste tags as mock description
            setIsAvailable(!dish.availabilityFlags?.includes("sold_out"));
            setIsFeatured(dish.availabilityFlags?.includes("featured") || false);
          }
        } catch (e) {
          Alert.alert("Error", "Failed to load dish details.");
        }
      }
      setIsLoading(false);
    }
    loadDish();
  }, [dishId]);

  const handleSave = async () => {
    if (!activeOutlet) return;
    if (!name.trim()) {
      Alert.alert("Validation", "Dish name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const updates = {
        name,
        price: parseFloat(price) || 0,
        availabilityFlags: [
          ...(!isAvailable ? ["sold_out"] : []),
          ...(isFeatured ? ["featured"] : []),
        ],
      };

      if (dishId) {
        await hungryService.merchant.editDish(activeOutlet.id, dishId, updates);
      } else {
        await hungryService.merchant.addDish(activeOutlet.id, updates as any);
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
    const generated = await hungryService.merchant.generateDishDescription(
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
    const suggestions = await hungryService.merchant.suggestIngredients(name);
    setIngredients(suggestions.join(", "));
  };

  if (isLoading) {
    return (
      <Screen style={{ backgroundColor: palette.bg }}>
        <AppText>Loading...</AppText>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: palette.bg }}>
      <View style={[styles.header, { paddingTop: spacing[3], paddingHorizontal: spacing[4] }]}>
        <IconButton
          accessibilityLabel="Go back"
          icon={<ChevronLeft size={24} color={palette.text} />}
          onPress={() => navigation.goBack()}
        />
        <AppText variant="h2" style={{ fontWeight: "800" }}>
          {dishId ? "Edit Dish" : "Add Dish"}
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing[4], gap: spacing[4], paddingBottom: 100 }}
      >
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
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: palette.surface, borderTopColor: palette.border },
        ]}
      >
        <Button
          label={isSaving ? "Saving..." : "Save Dish"}
          variant="primary"
          fullWidth
          onPress={handleSave}
          disabled={isSaving}
        />
      </View>
    </Screen>
  );
}

export default DishEditorScreen;

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
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
  footer: {
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: 32,
  },
});
