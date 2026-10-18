import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Alert, Pressable, ScrollView } from "react-native";
import { Plus, Search, MoreVertical, Camera, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  AccessibleImage,
  AppText,
  Button,
  IconButton,
  EmptyState,
  FAB,
  FilterChipRail,
  InlineSearchField,
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
import { getDishSection, hasAvailabilityFlag } from "@/features/merchant/menuSections";
import type { DishDetail } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "Menu">;
type MenuFilter = "all" | "available" | "sold_out";

const MENU_FILTER_OPTIONS: { id: MenuFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "sold_out", label: "Sold Out" },
];

function showError(title: string, error: unknown) {
  Alert.alert(title, error instanceof Error && error.message ? error.message : "Please try again.");
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
  const [filter, setFilter] = useState<MenuFilter>("all");
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
    // Group by menu section (unsectioned last), keeping newest-first within a section.
    return [...result].sort((left, right) => {
      const leftSection = getDishSection(left.availabilityFlags);
      const rightSection = getDishSection(right.availabilityFlags);
      if (leftSection === rightSection) return 0;
      if (!leftSection) return 1;
      if (!rightSection) return -1;
      return leftSection.localeCompare(rightSection);
    });
  }, [menu, searchQuery, filter]);
  const isVerified = activeOutlet?.verification?.status === "verified";

  useEffect(() => {
    prefetchImages(
      menu.map((dish) => dish.imageUrl || dish.gallery?.[0]),
      8,
    );
  }, [menu]);

  const previewVenueId = useMemo(
    () =>
      activeOutlet?.venueId ??
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
      showError("Could not update availability", e);
    }
  };

  const handleToggleFeatured = async (dish: DishDetail) => {
    if (!activeOutlet) return;
    try {
      const featured = await getHungryService().merchant.toggleFeatured(activeOutlet.id, dish.id);
      setMenu((prev) =>
        prev.map((d) =>
          d.id === dish.id
            ? {
                ...d,
                availabilityFlags: [
                  ...(d.availabilityFlags || []).filter(
                    (f) => !hasAvailabilityFlag([f], "featured"),
                  ),
                  ...(featured ? ["featured"] : []),
                ],
              }
            : d,
        ),
      );
    } catch (e) {
      showError("Could not update featured dish", e);
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
            showError("Could not delete dish", e);
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
      {
        text: hasAvailabilityFlag(dish.availabilityFlags, "featured")
          ? "Remove from Featured"
          : "Feature Dish",
        onPress: () => handleToggleFeatured(dish),
      },
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
          <View
            accessibilityRole="text"
            style={{
              backgroundColor: isVerified ? palette.successSoft : palette.bgSoft,
              borderColor: isVerified ? palette.success : palette.border,
              borderRadius: componentRadii.card,
              borderWidth: 1,
              padding: spacing[3],
            }}
          >
            <AppText variant="bodySmall">
              {isVerified
                ? "Changes you make here show to diners straight away."
                : "Your menu is saved but hidden from diners until Hungry verifies your stall."}
            </AppText>
          </View>

          <View style={{ paddingHorizontal: spacing[1] }}>
            <InlineSearchField
              accessibilityLabel="Search menu items"
              placeholder="Search menu..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <View style={{ marginTop: spacing[3] }}>
              <FilterChipRail
                options={MENU_FILTER_OPTIONS}
                selectedId={filter}
                onSelect={setFilter}
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
                const pillStyle = {
                  backgroundColor: palette.surfaceRaised,
                  borderColor: palette.border,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[1],
                };
                return (
                  <View
                    key={dish.id}
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
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${dish.name}`}
                      onPressIn={() => prefetchDishEditorRoute(dish)}
                      onLongPress={() => showDishOptions(dish)}
                      onPress={() => navigation.navigate("DishEditor", { dishId: dish.id })}
                      style={({ pressed }) => [
                        styles.dishEditTarget,
                        { gap: spacing[3], opacity: pressed ? 0.78 : 1 },
                      ]}
                    >
                      {imageUrl ? (
                        <AccessibleImage
                          source={{ uri: imageUrl }}
                          style={[styles.dishImage, { borderRadius: componentRadii.card }]}
                          decorative
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
                            <View style={[pillStyle, { backgroundColor: palette.errorSoft }]}>
                              <AppText variant="micro" tone="muted">
                                Sold Out
                              </AppText>
                            </View>
                          )}
                        </View>
                        <AppText variant="body" tone="muted" style={{ marginTop: 4 }}>
                          {[
                            dish.priceRange,
                            getDishSection(dish.availabilityFlags),
                            hasAvailabilityFlag(dish.availabilityFlags, "featured")
                              ? "Featured"
                              : undefined,
                            dish.tasteTags.slice(0, 2).join(", "),
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </AppText>
                        {dish.dietaryFlags.length > 0 && (
                          <View
                            style={[styles.flagRow, { gap: spacing[2], marginTop: spacing[2] }]}
                          >
                            {dish.dietaryFlags.slice(0, 3).map((flag) => (
                              <View key={flag} style={pillStyle}>
                                <AppText variant="micro" tone="muted">
                                  {formatDietaryFlag(flag)}
                                </AppText>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </Pressable>
                    <IconButton
                      accessibilityLabel="Dish options"
                      icon={<MoreVertical size={20} color={palette.textSecondary} />}
                      onPress={() => showDishOptions(dish)}
                    />
                  </View>
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
                label="Review Photo Drafts"
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
  dishCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  dishEditTarget: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
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
