import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Image, View, TextInput, StyleSheet, Alert, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Search, MoreVertical, Camera, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppText, Button, IconButton, EmptyState, Chip, Screen, Skeleton } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import type { DishDetail } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "Menu">;

function hasAvailabilityFlag(flags: readonly string[] | undefined, target: string): boolean {
  const normalizedTarget = target.toLowerCase().replace(/[\s-]+/g, "_");
  return (
    flags?.some((flag) => flag.toLowerCase().replace(/[\s-]+/g, "_") === normalizedTarget) ?? false
  );
}

function formatDietaryFlag(flag: string): string {
  return flag
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

export function MerchantMenuScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const rootNavigation = getRootNavigation(navigation as any);
  const repository = getDataRepository();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const insets = useSafeAreaInsets();

  const [menu, setMenu] = useState<DishDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "sold_out">("all");
  const [error, setError] = useState(false);

  const loadMenu = useCallback(async () => {
    if (!activeOutlet) return;
    setIsLoading(true);
    setError(false);
    try {
      const data = await getHungryService().merchant.getMenu(activeOutlet.id);
      setMenu(data);
    } catch (e) {
      console.error(e);
      setError(true);
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
      result = result.filter((d) => !hasAvailabilityFlag(d.availabilityFlags, "sold_out"));
    } else if (filter === "sold_out") {
      result = result.filter((d) => hasAvailabilityFlag(d.availabilityFlags, "sold_out"));
    }
    return result;
  }, [menu, searchQuery, filter]);

  const handleToggleSoldOut = async (dish: DishDetail) => {
    if (!activeOutlet) return;
    try {
      await getHungryService().merchant.toggleSoldOut(activeOutlet.id, dish.id);
      // Optimistic update
      setMenu((prev) =>
        prev.map((d) => {
          if (d.id === dish.id) {
            const isSoldOut = hasAvailabilityFlag(d.availabilityFlags, "sold_out");
            const flags = isSoldOut
              ? (d.availabilityFlags || []).filter((f) => !hasAvailabilityFlag([f], "sold_out"))
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
      await getHungryService().merchant.toggleFeatured(activeOutlet.id, dish.id);
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
            await getHungryService().merchant.deleteDish(activeOutlet.id, dish.id);
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
        text: hasAvailabilityFlag(dish.availabilityFlags, "sold_out")
          ? "Mark Available"
          : "Mark Sold Out",
        onPress: () => handleToggleSoldOut(dish),
      },
      { text: "Toggle Featured", onPress: () => handleToggleFeatured(dish) },
      { text: "Delete", style: "destructive", onPress: () => handleDelete(dish) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handlePreviewMenuAsCustomer = () => {
    const previewVenueId =
      menu[0]?.venueId ??
      activeOutlet?.signatureDishIds
        .map((dishId) => repository.getDishById(dishId)?.venueId)
        .find(Boolean) ??
      (activeOutlet?.buildingId
        ? repository.listVenuesByBuilding(activeOutlet.buildingId)[0]?.id
        : undefined);

    if (previewVenueId) {
      rootNavigation.navigate("StallDetail", { venueId: previewVenueId });
    } else {
      rootNavigation.navigate("DiscoverMap");
    }
  };

  return (
    <Screen
      title="Your Menu"
      headerRight={
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
      }
    >
      <View style={{ gap: spacing[4], width: "100%" }}>
        <View style={{ paddingHorizontal: spacing[1] }}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                borderRadius: radii.md,
                gap: spacing[2],
              },
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

        <View style={{ gap: spacing[3] }}>
          {isLoading && filteredMenu.length === 0 ? (
            <View style={{ gap: spacing[3] }}>
              <Skeleton height={110} borderRadius={radii.lg} />
              <Skeleton height={110} borderRadius={radii.lg} />
              <Skeleton height={110} borderRadius={radii.lg} />
            </View>
          ) : error ? (
            <EmptyState
              title="Failed to load menu"
              body="There was a problem loading your dishes."
              icon={<X size={48} color={palette.error} />}
              ctaLabel="Retry"
              onPress={loadMenu}
            />
          ) : filteredMenu.length === 0 && !isLoading ? (
            <EmptyState
              title="No dishes found"
              body="Try adding a new dish or importing from a photo using OCR Drafts."
              icon={<Search size={36} color={palette.textMuted} />}
            />
          ) : (
            filteredMenu.map((dish) => {
              const isSoldOut = hasAvailabilityFlag(dish.availabilityFlags, "sold_out");
              const imageUrl = dish.imageUrl || dish.gallery?.[0];
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
                      padding: spacing[4],
                      gap: spacing[3],
                    },
                  ]}
                >
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={[styles.dishImage, { borderRadius: radii.md }]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.dishImagePlaceholder,
                        { backgroundColor: palette.surfaceRaised, borderRadius: radii.md },
                      ]}
                    >
                      <Camera size={22} color={palette.textMuted} />
                    </View>
                  )}
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
                        <View style={{ backgroundColor: palette.errorSoft, borderRadius: radii.pill }}>
                          <Chip label="Sold Out" selected={false} />
                        </View>
                      )}
                    </View>
                    <AppText variant="body" tone="muted" style={{ marginTop: 4 }}>
                      {dish.priceRange} • {dish.tasteTags.slice(0, 3).join(", ")}
                    </AppText>
                    {dish.dietaryFlags.length > 0 && (
                      <View style={[styles.flagRow, { gap: spacing[2], marginTop: spacing[2] }]}>
                        {dish.dietaryFlags.slice(0, 3).map((flag) => (
                          <Chip key={flag} label={formatDietaryFlag(flag)} selected={false} />
                        ))}
                      </View>
                    )}
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
        </View>
      </View>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            padding: spacing[4],
            paddingBottom: Math.max(insets.bottom, spacing[4]),
            marginTop: spacing[8],
          },
        ]}
      >
        <Button
          label="Preview menu as customer"
          variant="secondary"
          fullWidth
          onPress={handlePreviewMenuAsCustomer}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  dishCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  dishImage: {
    width: 64,
    height: 64,
  },
  dishImagePlaceholder: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  flagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
});
