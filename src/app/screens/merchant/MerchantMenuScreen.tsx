import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Search, MoreVertical, Edit2, Archive, Star, Ban, Camera } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppText, Button, IconButton, Chip, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { hungryService } from "@/lib/services/mock/mockService";
import type { DishDetail } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "Menu">;

export function MerchantMenuScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const insets = useSafeAreaInsets();

  const [menu, setMenu] = useState<DishDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "sold_out">("all");

  const loadMenu = useCallback(async () => {
    if (!activeOutlet) return;
    setIsLoading(true);
    try {
      const data = await hungryService.merchant.getMenu(activeOutlet.id);
      setMenu(data);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to load menu.");
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      loadMenu();
    });
    return unsubscribe;
  }, [navigation, loadMenu]);

  const filteredMenu = useMemo(() => {
    let result = menu;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(q));
    }
    if (filter === "available") {
      result = result.filter((d) => !d.availabilityFlags?.includes("sold_out"));
    } else if (filter === "sold_out") {
      result = result.filter((d) => d.availabilityFlags?.includes("sold_out"));
    }
    return result;
  }, [menu, searchQuery, filter]);

  const handleToggleSoldOut = async (dish: DishDetail) => {
    if (!activeOutlet) return;
    try {
      await hungryService.merchant.toggleSoldOut(activeOutlet.id, dish.id);
      // Optimistic update
      setMenu((prev) =>
        prev.map((d) => {
          if (d.id === dish.id) {
            const isSoldOut = d.availabilityFlags?.includes("sold_out");
            const flags = isSoldOut
              ? (d.availabilityFlags || []).filter((f) => f !== "sold_out")
              : [...(d.availabilityFlags || []), "sold_out"];
            return { ...d, availabilityFlags: flags };
          }
          return d;
        }),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFeatured = async (dish: DishDetail) => {
    if (!activeOutlet) return;
    try {
      await hungryService.merchant.toggleFeatured(activeOutlet.id, dish.id);
      Alert.alert("Success", `${dish.name} featured status toggled.`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = (dish: DishDetail) => {
    if (!activeOutlet) return;
    Alert.alert("Delete Dish", `Are you sure you want to delete ${dish.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await hungryService.merchant.deleteDish(activeOutlet.id, dish.id);
            setMenu((prev) => prev.filter((d) => d.id !== dish.id));
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const showDishOptions = (dish: DishDetail) => {
    Alert.alert("Dish Options", dish.name, [
      { text: "Edit Dish", onPress: () => navigation.navigate("DishEditor", { dishId: dish.id }) },
      {
        text: dish.availabilityFlags?.includes("sold_out") ? "Mark Available" : "Mark Sold Out",
        onPress: () => handleToggleSoldOut(dish),
      },
      { text: "Toggle Featured", onPress: () => handleToggleFeatured(dish) },
      { text: "Delete", style: "destructive", onPress: () => handleDelete(dish) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <Screen style={{ backgroundColor: palette.bg }}>
      <View style={[styles.header, { paddingTop: spacing[3], paddingHorizontal: spacing[4] }]}>
        <AppText variant="h1" style={{ fontWeight: "800" }}>
          Your Menu
        </AppText>
        <View style={{ flexDirection: "row", gap: spacing[2], alignItems: "center" }}>
          <IconButton
            accessibilityLabel="Scan menu (OCR)"
            icon={<Camera size={24} color={palette.textSecondary} />}
            onPress={() => navigation.navigate("OCRDrafts")}
          />
          <Button
            label="Add Dish"
            variant="primary"
            size="sm"
            fullWidth={false}
            leftIcon={<Plus size={16} color={palette.white} />}
            onPress={() => navigation.navigate("DishEditor")}
          />
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[4] }}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Search size={20} color={palette.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            placeholder="Search menu..."
            placeholderTextColor={palette.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={{ flexDirection: "row", marginTop: spacing[3], gap: spacing[2] }}>
          <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
          <Chip
            label="Available"
            selected={filter === "available"}
            onPress={() => setFilter("available")}
          />
          <Chip
            label="Sold Out"
            selected={filter === "sold_out"}
            onPress={() => setFilter("sold_out")}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          paddingBottom: 100,
          gap: spacing[3],
        }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadMenu} />}
      >
        {filteredMenu.length === 0 && !isLoading ? (
          <View style={styles.emptyContainer}>
            <AppText variant="bodyBold">No dishes found</AppText>
            <AppText variant="body" tone="muted" style={{ textAlign: "center", marginTop: 8 }}>
              Try adding a new dish or importing from a photo using OCR Drafts.
            </AppText>
          </View>
        ) : (
          filteredMenu.map((dish) => {
            const isSoldOut = dish.availabilityFlags?.includes("sold_out");
            return (
              <Pressable
                key={dish.id}
                onLongPress={() => showDishOptions(dish)}
                onPress={() => navigation.navigate("DishEditor", { dishId: dish.id })}
                style={[
                  styles.dishCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: radii.lg,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <AppText
                      variant="bodyBold"
                      style={
                        isSoldOut
                          ? { textDecorationLine: "line-through", color: palette.textMuted }
                          : undefined
                      }
                    >
                      {dish.name}
                    </AppText>
                    {isSoldOut && (
                      <View style={{ backgroundColor: palette.errorSoft, borderRadius: 16 }}>
                        <Chip label="Sold Out" selected={false} />
                      </View>
                    )}
                  </View>
                  <AppText variant="body" tone="muted" style={{ marginTop: 4 }}>
                    {dish.priceRange} • {dish.tasteTags.slice(0, 3).join(", ")}
                  </AppText>
                </View>
                <IconButton
                  accessibilityLabel="Dish options"
                  icon={<MoreVertical size={20} color={palette.textSecondary} />}
                  onPress={() => showDishOptions(dish)}
                />
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            paddingBottom: Math.max(insets.bottom, spacing[4]),
          },
        ]}
      >
        <Button
          label="Preview menu as customer"
          variant="secondary"
          fullWidth
          onPress={() => Alert.alert("Preview", "Navigating to customer view...")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  dishCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
});
