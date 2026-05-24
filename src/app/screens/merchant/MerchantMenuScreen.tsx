import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Image, View, StyleSheet, Alert, Pressable, ScrollView } from "react-native";
import { Plus, Search, MoreVertical, Camera, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  AppText,
  Button,
  IconButton,
  EmptyState,
  Chip,
  FAB,
  Input,
  Screen,
  Skeleton,
} from "@/components/ui";
import {
  prefetchDishDetail,
  prefetchImages,
  prefetchStallDetail,
  preloadRoute,
} from "@/features/navigation/prefetch";
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
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const rootNavigation = getRootNavigation(navigation as any);
  const repository = getDataRepository();
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [menu, setMenu] = useState<DishDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "sold_out">("all");
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    if (!activeOutlet) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getHungryService().merchant.getMenu(activeOutlet.id);
      setMenu(data);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Unable to load dishes.");
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
      result = result.filter((dish) =>
        [
          dish.name,
          dish.description,
          dish.venueName,
          dish.priceRange,
          ...dish.tasteTags,
          ...dish.dietaryFlags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (filter === "available") {
      result = result.filter((d) => !hasAvailabilityFlag(d.availabilityFlags, "sold_out"));
    } else if (filter === "sold_out") {
      result = result.filter((d) => hasAvailabilityFlag(d.availabilityFlags, "sold_out"));
    }
    return result;
  }, [menu, searchQuery, filter]);

  useEffect(() => {
    prefetchImages(
      menu.map((dish) => dish.imageUrl || dish.gallery?.[0]),
      8,
    );
  }, [menu]);

  const previewVenueId = useMemo(
    () =>
      menu[0]?.venueId ??
      activeOutlet?.signatureDishIds
        .map((dishId) => repository.getDishById(dishId)?.venueId)
        .find(Boolean) ??
      (activeOutlet?.buildingId
        ? repository.listVenuesByBuilding(activeOutlet.buildingId)[0]?.id
        : undefined),
    [activeOutlet, menu, repository],
  );

  const prefetchDishEditorRoute = useCallback(
    (dish?: DishDetail) => {
      if (dish?.id) {
        prefetchDishDetail(dish.id, repository);
        preloadRoute(navigation, "DishEditor", { dishId: dish.id });
        return;
      }
      preloadRoute(navigation, "DishEditor");
    },
    [navigation, repository],
  );

  const prefetchPreviewMenuAsCustomer = useCallback(() => {
    if (previewVenueId) {
      prefetchStallDetail(previewVenueId, repository);
      preloadRoute(rootNavigation, "StallDetail", { venueId: previewVenueId });
    }
  }, [previewVenueId, repository, rootNavigation]);

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
    if (previewVenueId) {
      rootNavigation.navigate("StallDetail", { venueId: previewVenueId });
    } else {
      Alert.alert("Preview unavailable", "No customer-visible stall is linked to this menu yet.");
    }
  };

  return (
    <Screen
      title="Menu"
      scroll={false}
      headerRight={
        <Button
          label="Preview"
          variant="secondary"
          size="sm"
          fullWidth={false}
          onPressIn={prefetchPreviewMenuAsCustomer}
          onPress={handlePreviewMenuAsCustomer}
        />
      }
    >
      <View style={{ flex: 1, width: "100%" }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[20] }}
        >
          <View style={{ paddingHorizontal: spacing[1] }}>
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: componentRadii.card,
                  gap: spacing[2],
                },
              ]}
            >
              <Input
                placeholder="Search menu..."
                style={{ flex: 1 }}
                value={searchQuery}
                onChangeText={setSearchQuery}
                leftIcon={<Search size={20} color={palette.textMuted} />}
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
                errorMessage={error}
                sendErrorContext="Merchant menu"
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
                    onPressIn={() => prefetchDishEditorRoute(dish)}
                    onLongPress={() => showDishOptions(dish)}
                    onPress={() => navigation.navigate("DishEditor", { dishId: dish.id })}
                    style={[
                      styles.dishCard,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                        borderRadius: componentRadii.card,
                        padding: spacing[4],
                        gap: spacing[3],
                      },
                    ]}
                  >
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={[styles.dishImage, { borderRadius: componentRadii.card }]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.dishImagePlaceholder,
                          {
                            backgroundColor: palette.surfaceRaised,
                            borderRadius: componentRadii.card,
                          },
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
                          <View
                            style={{ backgroundColor: palette.errorSoft, borderRadius: radii.pill }}
                          >
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
        </ScrollView>

        <FAB>
          {showCreateOptions ? (
            <View
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                borderWidth: 1,
                gap: spacing[2],
                padding: spacing[3],
                minWidth: 220,
              }}
            >
              <Button
                label="Use Camera"
                variant="secondary"
                fullWidth
                leftIcon={<Camera size={16} color={palette.text} />}
                onPressIn={() => preloadRoute(navigation, "OCRDrafts")}
                onPress={() => {
                  setShowCreateOptions(false);
                  navigation.navigate("OCRDrafts");
                }}
              />
              <Button
                label="Add Menu Item Manually"
                variant="secondary"
                fullWidth
                leftIcon={<Plus size={16} color={palette.text} />}
                onPressIn={() => prefetchDishEditorRoute()}
                onPress={() => {
                  setShowCreateOptions(false);
                  navigation.navigate("DishEditor");
                }}
              />
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add menu item"
            onPress={() => setShowCreateOptions((current) => !current)}
            style={{
              alignItems: "center",
              backgroundColor: palette.orange,
              borderRadius: radii.pill,
              height: 56,
              justifyContent: "center",
              width: 56,
            }}
          >
            {showCreateOptions ? (
              <X size={26} color={palette.white} />
            ) : (
              <Plus size={28} color={palette.white} />
            )}
          </Pressable>
        </FAB>
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
});
