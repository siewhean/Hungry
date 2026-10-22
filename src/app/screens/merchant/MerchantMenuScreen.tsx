import { useMerchantOperationScope } from "@/features/merchant/useMerchantOperationScope";
import { useRef as useMerchantRequestRef } from "react";
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
import type { DishDetail } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "Menu">;
type MenuFilter = "all" | "available" | "sold_out";

const MENU_FILTER_OPTIONS: { id: MenuFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "sold_out", label: "Sold Out" },
];

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
  const captureOperation = useMerchantOperationScope();

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

  const requestGeneration = useMerchantRequestRef(0);
  const currentOutlet = useMerchantRequestRef(activeOutlet?.id);
  currentOutlet.current = activeOutlet?.id;
  const loadMenu = useCallback(async () => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    const request = ++requestGeneration.current;
    const outletId = activeOutlet?.id;
    const isCurrent = () =>
      request === requestGeneration.current && outletId === currentOutlet.current;
    if (!activeOutlet) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getHungryService().merchant.getMenu(activeOutlet.id);
      if (!isOperationCurrent()) return;

      if (!isCurrent()) return;
      setMenu(data);
    } catch (e) {
      if (!isOperationCurrent()) return;

      if (!isCurrent()) return;
      Alert.alert("Menu operation failed", e instanceof Error ? e.message : "Please retry.");
      setError(e instanceof Error ? e.message : "Unable to load dishes.");
    } finally {
      if (isOperationCurrent()) {
        if (isCurrent()) setIsLoading(false);
      }
    }
  }, [activeOutlet]);

  useEffect(() => {
    void loadMenu();
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
      activeOutlet?.venueId ??
      menu[0]?.venueId ??
      activeOutlet?.signatureDishIds
        .map((dishId) => repository.getDishById(dishId)?.venueId)
        .find(Boolean) ??
      undefined,
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

  const handleMenuPhoto = async () => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    if (!activeOutlet?.venueId) {
      Alert.alert(
        "Scan unavailable",
        "This outlet needs an authoritative venue mapping before uploading a menu.",
      );
      return;
    }
    try {
      const picker = await import("expo-image-picker");
      if (!isOperationCurrent()) return;

      const permission = await picker.requestMediaLibraryPermissionsAsync();
      if (!isOperationCurrent()) return;

      if (!permission.granted) {
        Alert.alert("Photo access needed", "Allow photo access to select your menu.");
        return;
      }
      const result = await picker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (!isOperationCurrent()) return;

      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      await getHungryService().supply.submitMenuPhoto({
        venueId: activeOutlet.venueId,
        photoUri: asset.uri,
        photoMimeType: asset.mimeType ?? undefined,
        photoFileSizeBytes: asset.fileSize,
      });
      if (!isOperationCurrent()) return;

      navigation.navigate("OCRDrafts");
    } catch (error) {
      if (!isOperationCurrent()) return;

      Alert.alert("Menu upload failed", error instanceof Error ? error.message : "Please retry.");
    }
  };

  const handleToggleSoldOut = async (dish: DishDetail) => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    if (!activeOutlet) return;
    try {
      await getHungryService().merchant.toggleSoldOut(activeOutlet.id, dish.id);
      if (!isOperationCurrent()) return;

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
      if (!isOperationCurrent()) return;

      Alert.alert("Menu operation failed", e instanceof Error ? e.message : "Please retry.");
    }
  };

  const handleToggleFeatured = async (dish: DishDetail) => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    if (!activeOutlet) return;
    try {
      await getHungryService().merchant.toggleFeatured(activeOutlet.id, dish.id);
      if (!isOperationCurrent()) return;

      await loadMenu();
      if (!isOperationCurrent()) return;
    } catch (e) {
      if (!isOperationCurrent()) return;

      Alert.alert("Menu operation failed", e instanceof Error ? e.message : "Please retry.");
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
          const isOperationCurrent = captureOperation();
          if (!isOperationCurrent()) return;

          try {
            await getHungryService().merchant.deleteDish(activeOutlet.id, dish.id);
            if (!isOperationCurrent()) return;

            setMenu((prev) => prev.filter((d) => d.id !== dish.id));
          } catch (e) {
            if (!isOperationCurrent()) return;

            Alert.alert("Menu operation failed", e instanceof Error ? e.message : "Please retry.");
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
                          {dish.priceRange} • {dish.tasteTags.slice(0, 3).join(", ")}
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
                label="Scan menu photo"
                variant="secondary"
                fullWidth
                leftIcon={<Camera size={16} color={palette.text} />}
                onPressIn={() => preloadRoute(navigation, "OCRDrafts")}
                onPress={() => {
                  setShowCreateOptions(false);
                  void handleMenuPhoto();
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
