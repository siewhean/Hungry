import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  SectionList,
  RefreshControl,
  Switch,
  Modal,
} from "react-native";
import { Camera, Info, MoreVertical, Plus, Search, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  AccessibleImage,
  AppSymbol,
  AppText,
  PressableScale,
  Button,
  Dialog,
  IconButton,
  EmptyState,
  FAB,
  FilterChipRail,
  InlineBanner,
  InlineSearchField,
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
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import {
  getDishSection,
  groupDishesBySection,
  hasAvailabilityFlag,
} from "@/features/merchant/menuSections";
import { formatDishPrice, parseDishPrice } from "@/features/merchant/dishPrice";
import {
  MAX_FEATURED_DISHES,
  countFeaturedDishes,
  isFeaturedLimitError,
} from "@/features/merchant/featuredDishes";
import { isLockedLiveDish, isVerificationCurrent } from "@/features/merchant/merchantGuards";
import { trackMerchantEvent } from "@/features/merchant/merchantTracking";
import { useMerchantDialog, type ShowMerchantAlert } from "@/features/merchant/useMerchantDialog";
import { reportError } from "@/lib/monitoring/reportError";
import type { DishDetail } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "Menu">;
type MenuFilter = "all" | "available" | "sold_out";

const MENU_FILTER_OPTIONS: { id: MenuFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "sold_out", label: "Sold out" },
];

function showError(showAlert: ShowMerchantAlert, title: string, error: unknown) {
  showAlert(title, error instanceof Error && error.message ? error.message : "Please try again.");
}

/**
 * Photo drafts need a menu-photo upload and scan pipeline that the app does not have, so the
 * list could never hold a draft. The entry stays hidden until that ships.
 */
const MENU_PHOTO_DRAFTS_ENABLED = false;

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
  const { showAlert, dialog } = useMerchantDialog();

  const [menu, setMenu] = useState<DishDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Only the newest load may write: an outlet switch or a quick refocus never lets an older
  // response land last.
  const latestRequestId = useRef(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Dishes with a Featured request in flight: a second tap waits instead of flipping it back.
  const featuredInFlight = useRef(new Set<string>());
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<MenuFilter>("all");
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceEdit, setPriceEdit] = useState<{ dish: DishDetail; value: string } | null>(null);
  const [priceError, setPriceError] = useState<string | undefined>();
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [dishDialog, setDishDialog] = useState<{
    dish: DishDetail;
    confirmDelete: boolean;
  } | null>(null);
  // Dialog closes itself after a button press; "Remove from menu" switches to the confirm step.
  const keepDishDialogOpen = useRef(false);

  const activeOutletId = activeOutlet?.id;

  // The previous outlet's dishes must not show under the new one while it loads.
  useEffect(() => {
    latestRequestId.current += 1;
    setMenu([]);
    setError(null);
    setIsLoading(false);
  }, [activeOutletId]);

  const loadMenu = useCallback(async () => {
    if (!activeOutletId) return;
    const requestId = ++latestRequestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getHungryService().merchant.getMenu(activeOutletId);
      if (requestId !== latestRequestId.current) return;
      setMenu(data);
    } catch (e) {
      if (requestId !== latestRequestId.current) return;
      reportError(e, { screen: "MerchantMenu", action: "load_menu" });
      setError(e instanceof Error ? e.message : "Unable to load dishes.");
    } finally {
      if (requestId === latestRequestId.current) setIsLoading(false);
    }
  }, [activeOutletId]);

  const refreshMenu = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadMenu();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadMenu]);

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
    return result;
  }, [menu, searchQuery, filter]);
  // Sections A to Z (unsectioned last), newest first within a section; no headers when the
  // menu has no sections.
  const menuSections = useMemo(() => groupDishesBySection(filteredMenu), [filteredMenu]);
  const isVerified = isVerificationCurrent(activeOutlet?.verification);

  useEffect(() => {
    prefetchImages(
      menu.map((dish) => dish.imageUrl || dish.gallery?.[0]),
      8,
    );
  }, [menu]);

  // The outlet's own venue only: guessing from a signature dish or the building can open another
  // stall.
  const previewVenueId = activeOutlet?.venueId || undefined;

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
    selectHaptic();
    setMenu((prev) => prev.map((d) => (d.id === dish.id ? withSoldOut(d, nextSoldOut) : d)));
    try {
      await getHungryService().merchant.toggleSoldOut(activeOutlet.id, dish.id, nextSoldOut);
      trackMerchantEvent("merchant_dish_sold_out_toggled", activeOutlet.id, {
        sold_out: nextSoldOut,
      });
    } catch (e) {
      setMenu((prev) => prev.map((d) => (d.id === dish.id ? withSoldOut(d, !nextSoldOut) : d)));
      reportError(e, { screen: "MerchantMenu", action: "toggle_sold_out" });
      showError(showAlert, "Could not update availability", e);
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
    let changedIds = new Set<string>();
    try {
      changedIds = new Set(
        await getHungryService().merchant.setDishesSoldOut(
          activeOutlet.id,
          soldOutDishes.map((dish) => dish.id),
          false,
        ),
      );
    } catch (e) {
      // Every dish is put back below.
      reportError(e, { screen: "MerchantMenu", action: "mark_all_available" });
    }
    const failedIds = new Set(
      soldOutDishes.filter((dish) => !changedIds.has(dish.id)).map((d) => d.id),
    );
    trackMerchantEvent("merchant_dish_sold_out_toggled", activeOutlet.id, {
      sold_out: false,
      bulk_count: ids.size - failedIds.size,
    });
    if (failedIds.size > 0) {
      setMenu((prev) => prev.map((d) => (failedIds.has(d.id) ? withSoldOut(d, true) : d)));
      showAlert(
        "Some dishes were not updated",
        `${failedIds.size} dish${failedIds.size === 1 ? " is" : "es are"} still sold out. Please try again.`,
      );
    }
  };

  const showFeaturedLimit = () =>
    showAlert(
      `${MAX_FEATURED_DISHES} of ${MAX_FEATURED_DISHES} featured`,
      "You can feature up to 3 dishes. Remove Featured from another dish first.",
    );

  const handleToggleFeatured = async (dish: DishDetail) => {
    if (!activeOutlet || featuredInFlight.current.has(dish.id)) return;
    featuredInFlight.current.add(dish.id);
    // The explicit target state: a retried or repeated request cannot toggle it back.
    const nextFeatured = !hasAvailabilityFlag(dish.availabilityFlags, "featured");
    if (nextFeatured && countFeaturedDishes(menu) >= MAX_FEATURED_DISHES) {
      featuredInFlight.current.delete(dish.id);
      showFeaturedLimit();
      return;
    }
    try {
      const featured = await getHungryService().merchant.toggleFeatured(
        activeOutlet.id,
        dish.id,
        nextFeatured,
      );
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
      // A fourth featured dish refused by the database is an answer, not a failure to report.
      if (isFeaturedLimitError(e)) {
        showFeaturedLimit();
      } else {
        reportError(e, { screen: "MerchantMenu", action: "toggle_featured" });
        showError(showAlert, "Could not update featured dish", e);
      }
    } finally {
      featuredInFlight.current.delete(dish.id);
    }
  };

  const openPriceEdit = (dish: DishDetail) => {
    setPriceError(undefined);
    setPriceEdit({ dish, value: dish.price ? dish.price.toFixed(2) : "" });
  };

  const closePriceEdit = () => {
    if (isSavingPrice) return;
    setPriceEdit(null);
    setPriceError(undefined);
  };

  // A price change is its own small save: no trip through the full editor.
  const handleSavePrice = async () => {
    if (!activeOutlet || !priceEdit || isSavingPrice) return;
    const price = parseDishPrice(priceEdit.value);
    if (price === null) {
      setPriceError("Enter a price between S$0.01 and S$9,999, e.g. 5.50.");
      return;
    }
    const { dish } = priceEdit;
    setIsSavingPrice(true);
    setPriceError(undefined);
    try {
      await getHungryService().merchant.editDish(activeOutlet.id, dish.id, {
        price,
        priceRange: formatDishPrice(price),
      });
      trackMerchantEvent("merchant_dish_price_changed", activeOutlet.id);
      setMenu((prev) =>
        prev.map((d) =>
          d.id === dish.id ? { ...d, price, priceRange: formatDishPrice(price) } : d,
        ),
      );
      setPriceEdit(null);
    } catch (e) {
      reportError(e, { screen: "MerchantMenu", action: "edit_price" });
      setPriceError(e instanceof Error && e.message ? e.message : "Could not save the price.");
    } finally {
      setIsSavingPrice(false);
    }
  };

  const handleDelete = async (dish: DishDetail) => {
    if (!activeOutlet) return;
    try {
      await getHungryService().merchant.deleteDish(activeOutlet.id, dish.id);
      trackMerchantEvent("merchant_dish_deleted", activeOutlet.id);
      setMenu((prev) => prev.filter((d) => d.id !== dish.id));
    } catch (e) {
      reportError(e, { screen: "MerchantMenu", action: "remove_dish" });
      showError(showAlert, "Could not remove dish", e);
    }
  };

  // A Dialog rather than the native alert: Android alerts drop every button after the third.
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
            text: "Remove",
            style: "destructive" as const,
            onPress: () => void handleDelete(dishDialog.dish),
          },
          { text: "Cancel", style: "cancel" as const },
        ]
      : [
          {
            text: "Edit dish",
            onPress: () => navigation.navigate("DishEditor", { dishId: dishDialog.dish.id }),
          },
          ...(isLockedLiveDish(dishDialog.dish, isVerified)
            ? []
            : [
                {
                  text: hasAvailabilityFlag(dishDialog.dish.availabilityFlags, "sold_out")
                    ? "Mark available"
                    : "Sold out until tomorrow",
                  onPress: () => void handleToggleSoldOut(dishDialog.dish),
                },
                {
                  text: hasAvailabilityFlag(dishDialog.dish.availabilityFlags, "featured")
                    ? `Remove from featured (${countFeaturedDishes(menu)} of ${MAX_FEATURED_DISHES})`
                    : `Feature dish (${countFeaturedDishes(menu)} of ${MAX_FEATURED_DISHES} featured)`,
                  onPress: () => void handleToggleFeatured(dishDialog.dish),
                },
              ]),
          {
            text: "Remove from menu",
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
    }
  };

  return (
    <Screen
      title="Menu"
      showBack={false}
      scroll={false}
      headerRight={
        <Button
          label="Preview"
          variant="secondary"
          size="sm"
          fullWidth={false}
          disabled={!previewVenueId}
          accessibilityHint={
            previewVenueId ? undefined : "Available once your stall is linked to a listing"
          }
          onPressIn={prefetchPreviewMenuAsCustomer}
          onPress={handlePreviewMenuAsCustomer}
        />
      }
    >
      <View style={{ flex: 1, width: "100%" }}>
        <SectionList
          sections={error && menu.length === 0 ? [] : menuSections}
          keyExtractor={(dish) => dish.id}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void refreshMenu()}
              tintColor={palette.orange}
            />
          }
          contentContainerStyle={{ paddingBottom: spacing[20] }}
          ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View
                accessibilityRole="header"
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: spacing[2],
                  paddingHorizontal: spacing[1],
                  paddingTop: spacing[4],
                  paddingBottom: spacing[2],
                }}
              >
                <AppText variant="bodyBold">{section.title}</AppText>
                <AppText variant="bodySmall" tone="muted">
                  {section.data.length}
                </AppText>
              </View>
            ) : null
          }
          ListHeaderComponent={
            <View style={{ gap: spacing[4], marginBottom: spacing[2] }}>
              <View
                accessibilityRole="text"
                style={{
                  alignItems: "flex-start",
                  backgroundColor: palette.infoSoft,
                  borderColor: palette.border,
                  borderRadius: componentRadii.card,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: spacing[2],
                  padding: spacing[3],
                }}
              >
                <AppSymbol name="info.circle" fallback={Info} size={18} color={palette.info} />
                <AppText variant="bodySmall" style={{ flex: 1 }}>
                  {isVerified
                    ? "Changes you make here show to diners straight away. Sold-out dishes come back on automatically at midnight."
                    : "Dishes you add are saved as drafts, hidden from diners until Hungry verifies your stall. Dishes diners already see can be changed once you are verified."}
                </AppText>
              </View>

              {error && menu.length > 0 ? (
                <InlineBanner
                  tone="warning"
                  message="Could not refresh your menu. Showing what we loaded earlier. Pull down to try again."
                />
              ) : null}

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
            </View>
          }
          ListEmptyComponent={
            isLoading ? (
              <View style={{ gap: spacing[3] }}>
                <Skeleton height={80} borderRadius={radii.lg} />
                <Skeleton height={80} borderRadius={radii.lg} />
                <Skeleton height={80} borderRadius={radii.lg} />
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
            ) : (
              <EmptyState
                title="No dishes found"
                body="Try adding a new dish."
                icon={<Search size={36} color={palette.textMuted} />}
              />
            )
          }
          renderItem={({ item: dish }) => {
            const isSoldOut = hasAvailabilityFlag(dish.availabilityFlags, "sold_out");
            const isLocked = isLockedLiveDish(dish, isVerified);
            const imageUrl = dish.imageUrl || dish.gallery?.[0];
            const pillStyle = {
              backgroundColor: palette.surfaceRaised,
              borderColor: palette.border,
              borderRadius: radii.pill,
              borderWidth: 1,
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[0.5],
            };
            const imageFallback = (
              <View
                style={[
                  styles.dishImage,
                  styles.dishImagePlaceholder,
                  {
                    backgroundColor: palette.surfaceRaised,
                    borderRadius: componentRadii.card,
                  },
                ]}
              >
                <Camera size={20} color={palette.textMuted} />
              </View>
            );
            const meta = [
              getDishSection(dish.availabilityFlags),
              hasAvailabilityFlag(dish.availabilityFlags, "featured") ? "Featured" : undefined,
              dish.tasteTags.slice(0, 2).join(", "),
            ]
              .filter(Boolean)
              .join(" • ");
            return (
              <View
                key={dish.id}
                style={[
                  styles.dishCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: componentRadii.card,
                    padding: spacing[3],
                    gap: spacing[2],
                  },
                ]}
              >
                <View style={[styles.dishTopRow, { gap: spacing[2] }]}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${dish.name}`}
                    onPressIn={() => prefetchDishEditorRoute(dish)}
                    onLongPress={() => showDishOptions(dish)}
                    onPress={() => navigation.navigate("DishEditor", { dishId: dish.id })}
                    style={[styles.dishEditTarget, { gap: spacing[3] }]}
                  >
                    {imageUrl ? (
                      <AccessibleImage
                        source={{ uri: imageUrl }}
                        style={[styles.dishImage, { borderRadius: componentRadii.card }]}
                        decorative
                        fallback={imageFallback}
                      />
                    ) : (
                      imageFallback
                    )}
                    <View style={{ flex: 1, gap: spacing[0.5] }}>
                      <AppText variant="bodyBold" numberOfLines={2}>
                        {dish.name}
                      </AppText>
                      {meta ? (
                        <AppText variant="bodySmall" tone="muted" numberOfLines={1}>
                          {meta}
                        </AppText>
                      ) : null}
                    </View>
                  </PressableScale>
                  <Switch
                    accessibilityLabel={`${dish.name} available`}
                    accessibilityState={{ checked: !isSoldOut, disabled: isLocked }}
                    disabled={isLocked}
                    value={!isSoldOut}
                    onValueChange={(available) => void handleToggleSoldOut(dish, !available)}
                    trackColor={{ false: palette.border, true: palette.orange }}
                    thumbColor={palette.white}
                    ios_backgroundColor={palette.border}
                  />
                  <IconButton
                    accessibilityLabel="Dish options"
                    icon={
                      <AppSymbol
                        name="ellipsis"
                        fallback={MoreVertical}
                        size={20}
                        color={palette.textSecondary}
                      />
                    }
                    onPress={() => showDishOptions(dish)}
                  />
                </View>
                {/* Second line: the price and the badges sit under the name, indented past the photo. */}
                <View
                  style={[
                    styles.dishSecondRow,
                    { gap: spacing[2], paddingLeft: DISH_IMAGE_SIZE + spacing[3] },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Change price of ${dish.name}, ${dish.priceRange}`}
                    accessibilityState={{ disabled: isLocked }}
                    disabled={isLocked}
                    hitSlop={8}
                    onPress={() => openPriceEdit(dish)}
                  >
                    <AppText variant="bodyBold">{dish.priceRange}</AppText>
                  </Pressable>
                  {isSoldOut ? (
                    <View style={[pillStyle, { backgroundColor: palette.errorSoft }]}>
                      <AppText variant="micro" tone="muted">
                        Sold out
                      </AppText>
                    </View>
                  ) : null}
                  {dish.isMerchantDraft ? (
                    <View style={pillStyle}>
                      <AppText variant="micro" tone="muted">
                        Draft
                      </AppText>
                    </View>
                  ) : null}
                  {dish.dietaryFlags.slice(0, 2).map((flag) => (
                    <View key={flag} style={pillStyle}>
                      <AppText variant="micro" tone="muted">
                        {formatDietaryFlag(flag)}
                      </AppText>
                    </View>
                  ))}
                  {isLocked ? (
                    <AppText variant="micro" tone="muted">
                      Verify to change live dishes
                    </AppText>
                  ) : null}
                </View>
              </View>
            );
          }}
        />

        <FAB>
          {MENU_PHOTO_DRAFTS_ENABLED && showCreateOptions ? (
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
                label="Photo drafts"
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
                label="Add menu item manually"
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
            onPress={() =>
              MENU_PHOTO_DRAFTS_ENABLED
                ? setShowCreateOptions((current) => !current)
                : navigation.navigate("DishEditor")
            }
            style={{
              alignItems: "center",
              backgroundColor: palette.orange,
              borderRadius: radii.pill,
              height: 56,
              justifyContent: "center",
              width: 56,
            }}
          >
            {MENU_PHOTO_DRAFTS_ENABLED && showCreateOptions ? (
              <X size={26} color={palette.textOnOrange} />
            ) : (
              <Plus size={28} color={palette.textOnOrange} />
            )}
          </Pressable>
        </FAB>
      </View>
      {dialog}
      {priceEdit ? (
        <Modal visible transparent animationType="fade" onRequestClose={closePriceEdit}>
          <View style={[styles.priceBackdrop, { backgroundColor: palette.overlay }]}>
            <View
              accessibilityViewIsModal
              style={{
                backgroundColor: palette.surface,
                borderRadius: componentRadii.card,
                gap: spacing[3],
                padding: spacing[4],
                width: "100%",
              }}
            >
              <AppText variant="bodyBold">Change price</AppText>
              <AppText variant="bodySmall" tone="muted">
                {priceEdit?.dish.name}
              </AppText>
              <Input
                label="Price (S$)"
                value={priceEdit?.value ?? ""}
                onChangeText={(value) => {
                  setPriceEdit((current) => (current ? { ...current, value } : current));
                  setPriceError(undefined);
                }}
                keyboardType="decimal-pad"
                errorText={priceError}
                error={Boolean(priceError)}
                autoFocus
                onSubmitEditing={() => void handleSavePrice()}
              />
              <View style={{ flexDirection: "row", gap: spacing[2], justifyContent: "flex-end" }}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  fullWidth={false}
                  disabled={isSavingPrice}
                  onPress={closePriceEdit}
                />
                <Button
                  label={isSavingPrice ? "Saving..." : "Save price"}
                  fullWidth={false}
                  disabled={isSavingPrice}
                  onPress={() => void handleSavePrice()}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
      <Dialog
        visible={Boolean(dishDialog)}
        title={dishDialog?.confirmDelete ? "Remove from menu?" : "Dish options"}
        message={
          dishDialog?.confirmDelete
            ? `Remove ${dishDialog.dish.name} from your menu? Diner reviews and saves are kept.`
            : dishDialog?.dish.name
        }
        buttons={dishDialogButtons}
        onClose={closeDishDialog}
      />
    </Screen>
  );
}

const DISH_IMAGE_SIZE = 56;

const styles = StyleSheet.create({
  priceBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dishCard: {
    borderWidth: 1,
  },
  dishTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dishSecondRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  dishEditTarget: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  dishImage: {
    width: DISH_IMAGE_SIZE,
    height: DISH_IMAGE_SIZE,
  },
  dishImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  flagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
