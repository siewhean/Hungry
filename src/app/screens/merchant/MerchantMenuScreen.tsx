import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { View, StyleSheet, Alert, Pressable, ScrollView, Switch } from "react-native";
import { Plus, Search, MoreVertical, Camera, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  AccessibleImage,
  AppText,
  Button,
  Dialog,
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
import { trackMerchantEvent } from "@/features/merchant/merchantTracking";
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

function withSoldOut(dish: DishDetail, soldOut: boolean): DishDetail {
  const flags = (dish.availabilityFlags || []).filter((f) => !hasAvailabilityFlag([f], "sold_out"));
  return { ...dish, availabilityFlags: soldOut ? [...flags, "sold_out"] : flags };
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
  const [dishDialog, setDishDialog] = useState<{
    dish: DishDetail;
    confirmDelete: boolean;
  } | null>(null);
  // Dialog closes itself after a button press; "Delete Dish" switches to the confirm step instead.
  const keepDishDialogOpen = useRef(false);

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
      trackMerchantEvent("merchant_menu_viewed", activeOutlet?.id);
    });
    return unsubscribe;
  }, [navigation, loadMenu, activeOutlet?.id]);

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

  // Optimistic: flip the row now, send the explicit target state, roll back on failure.
  const handleToggleSoldOut = async (dish: DishDetail, soldOut?: boolean) => {
    if (!activeOutlet) return;
    const nextSoldOut = soldOut ?? !hasAvailabilityFlag(dish.availabilityFlags, "sold_out");
    setMenu((prev) => prev.map((d) => (d.id === dish.id ? withSoldOut(d, nextSoldOut) : d)));
    try {
      await getHungryService().merchant.toggleSoldOut(activeOutlet.id, dish.id, nextSoldOut);
      trackMerchantEvent("merchant_dish_sold_out_toggled", activeOutlet.id, {
        sold_out: nextSoldOut,
      });
    } catch (e) {
      setMenu((prev) => prev.map((d) => (d.id === dish.id ? withSoldOut(d, !nextSoldOut) : d)));
      showError("Could not update availability", e);
    }
  };

  const soldOutDishes = useMemo(
    () => menu.filter((dish) => hasAvailabilityFlag(dish.availabilityFlags, "sold_out")),
    [menu],
  );

  const handleMarkAllAvailable = async () => {
    if (!activeOutlet || soldOutDishes.length === 0) return;
    const ids = new Set(soldOutDishes.map((dish) => dish.id));
    setMenu((prev) => prev.map((d) => (ids.has(d.id) ? withSoldOut(d, false) : d)));
    const results = await Promise.allSettled(
      soldOutDishes.map((dish) =>
        getHungryService().merchant.toggleSoldOut(activeOutlet.id, dish.id, false),
      ),
    );
    const failedIds = new Set(
      soldOutDishes.filter((_, index) => results[index]?.status === "rejected").map((d) => d.id),
    );
    trackMerchantEvent("merchant_dish_sold_out_toggled", activeOutlet.id, {
      sold_out: false,
      bulk_count: ids.size - failedIds.size,
    });
    if (failedIds.size > 0) {
      setMenu((prev) => prev.map((d) => (failedIds.has(d.id) ? withSoldOut(d, true) : d)));
      Alert.alert(
        "Some dishes were not updated",
        `${failedIds.size} dish${failedIds.size === 1 ? " is" : "es are"} still sold out. Please try again.`,
      );
    }
  };

  const handleToggleFeatured = async (dish: DishDetail) => {
    if (!activeOutlet) return;
    try {
      const featured = await getHungryService().merchant.toggleFeatured(activeOutlet.id, dish.id);
      trackMerchantEvent("merchant_dish_featured_toggled", activeOutlet.id, { featured });
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

  const handleDelete = async (dish: DishDetail) => {
    if (!activeOutlet) return;
    try {
      await getHungryService().merchant.deleteDish(activeOutlet.id, dish.id);
      trackMerchantEvent("merchant_dish_deleted", activeOutlet.id);
      setMenu((prev) => prev.filter((d) => d.id !== dish.id));
    } catch (e) {
      showError("Could not delete dish", e);
    }
  };

  // A Dialog, not Alert.alert: Android alerts drop every button after the third.
  const showDishOptions = (dish: DishDetail) => setDishDialog({ dish, confirmDelete: false });
  const closeDishDialog = () => {
    if (keepDishDialogOpen.current) {
      keepDishDialogOpen.current = false;
      return;
    }
    setDishDialog(null);
  };
  const dishDialogButtons = !dishDialog
    ? []
    : dishDialog.confirmDelete
      ? [
          {
            text: "Delete",
            style: "destructive" as const,
            onPress: () => void handleDelete(dishDialog.dish),
          },
          { text: "Cancel", style: "cancel" as const },
        ]
      : [
          {
            text: "Edit Dish",
            onPress: () => navigation.navigate("DishEditor", { dishId: dishDialog.dish.id }),
          },
          {
            text: hasAvailabilityFlag(dishDialog.dish.availabilityFlags, "sold_out")
              ? "Mark Available"
              : "Sold Out Until Tomorrow",
            onPress: () => void handleToggleSoldOut(dishDialog.dish),
          },
          {
            text: hasAvailabilityFlag(dishDialog.dish.availabilityFlags, "featured")
              ? "Remove from Featured"
              : "Feature Dish",
            onPress: () => void handleToggleFeatured(dishDialog.dish),
          },
          {
            text: "Delete Dish",
            style: "destructive" as const,
            onPress: () => {
              keepDishDialogOpen.current = true;
              setDishDialog({ dish: dishDialog.dish, confirmDelete: true });
            },
          },
          { text: "Cancel", style: "cancel" as const },
        ];

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
                ? "Changes you make here show to diners straight away. Sold-out dishes come back on automatically at midnight."
                : "Dishes you add are saved as drafts, hidden from diners until Hungry verifies your stall. Dishes diners already see can be changed once you are verified."}
            </AppText>
          </View>

          <View style={{ paddingHorizontal: spacing[1] }}>
            <InlineSearchField
              accessibilityLabel="Search menu items"
              placeholder="Search menu..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {soldOutDishes.length > 0 ? (
              <View style={{ marginTop: spacing[3] }}>
                <Button
                  label={`Mark all available (${soldOutDishes.length})`}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={() => void handleMarkAllAvailable()}
                />
              </View>
            ) : null}

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
                    <View style={{ alignItems: "center", gap: spacing[0.5] }}>
                      <Switch
                        accessibilityLabel={`${dish.name} available`}
                        accessibilityState={{ checked: !isSoldOut }}
                        value={!isSoldOut}
                        onValueChange={(available) => void handleToggleSoldOut(dish, !available)}
                        trackColor={{ false: palette.border, true: palette.orange }}
                        thumbColor={palette.white}
                        ios_backgroundColor={palette.border}
                      />
                      <AppText variant="micro" tone="muted">
                        {isSoldOut ? "Sold out" : "Available"}
                      </AppText>
                    </View>
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
      <Dialog
        visible={Boolean(dishDialog)}
        title={dishDialog?.confirmDelete ? "Delete Dish" : "Dish Options"}
        message={
          dishDialog?.confirmDelete
            ? `Are you sure you want to delete ${dishDialog.dish.name}?`
            : dishDialog?.dish.name
        }
        buttons={dishDialogButtons}
        onClose={closeDishDialog}
      />
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
