import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Clock, ExternalLink, Heart, ListPlus, MapPin } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AccessibleImage, AppText, Button, EmptyState, Screen, Skeleton } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useDetailSaveActions } from "@/features/checklistPortfolio/DetailSaveActions";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { openMerchantProfileLink } from "@/lib/security/safeLinking";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import {
  CatalogAccessError,
  type CatalogPage,
  type CatalogRawDishCard,
  type CatalogRawDishDetail,
  type CatalogRawVenueDetail,
} from "@/lib/services/catalog";
import {
  recordCatalogDiagnostic,
  summarizeCatalogRequest,
} from "@/lib/services/catalog/diagnostics";
import { appendUniqueById } from "@/lib/services/catalog/paging";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "CatalogRawDetail">;
type Detail = CatalogRawDishDetail | CatalogRawVenueDetail;

const VENUE_MENU_PAGE_SIZE = 24;

function DetailHeader({ title, onBack }: { title?: string; onBack: () => void }) {
  const { palette, spacing } = useHungryTheme();
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: spacing[3],
        paddingHorizontal: spacing[4],
        paddingTop: spacing[3],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={onBack}
      >
        <ArrowLeft color={palette.text} size={24} />
      </Pressable>
      {title ? (
        <AppText numberOfLines={1} style={{ flex: 1 }} variant="h2">
          {title}
        </AppText>
      ) : null}
    </View>
  );
}

/** "example.com" from a source URL; the full address is long and not useful to read. */
function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

function statusLabel(status: Detail["verificationStatus"]) {
  return status === "approved"
    ? "Approved source"
    : status === "verified"
      ? "Source verified"
      : "Unverified source";
}

export function CatalogRawDetailScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  // Catalog record; sign-in is required. Dishes can be saved (and, in the
  // catalog_save_to_list_v1 test, saved to a list).
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const service = getCatalogRawService();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [menu, setMenu] = useState<CatalogPage<CatalogRawDishCard> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isDish = route.params.kind === "dish";
  const isFavourite = useProfileStore((state) =>
    state.profile.favouriteDishIds.includes(route.params.id),
  );
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const showToast = useUIStore((state) => state.showToast);
  const [isSavingFavourite, setIsSavingFavourite] = useState(false);
  const [isLoadingMoreMenu, setIsLoadingMoreMenu] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const loadedDish = isDish && detail && !error ? (detail as CatalogRawDishDetail) : null;
  // Only signed-in diners looking at a loaded dish see the two arms differ, so only they are
  // exposed; guests, stall pages and the loading/error states never are.
  const saveExperimentEligible =
    isAuthenticated &&
    loadedDish !== null &&
    FEATURE_FLAGS.favouritesEnabled &&
    FEATURE_FLAGS.portfoliosEnabled;
  const saveVariant = useExperimentVariant("catalog_save_to_list_v1", {
    enabled: saveExperimentEligible,
  });
  const showSaveToList = saveExperimentEligible && saveVariant === "save_with_lists";
  const saveTarget = useMemo(
    () => ({
      itemType: "dish" as const,
      id: route.params.id,
      label: loadedDish?.name ?? "This dish",
      venueId: loadedDish?.venueId,
    }),
    [loadedDish?.name, loadedDish?.venueId, route.params.id],
  );
  const { addToPortfolio, isAddingToPortfolio, saveToListSheet } = useDetailSaveActions({
    navigation,
    target: saveTarget,
    surface: "catalog_detail",
  });
  const lastViewedDishId = useRef<string | null>(null);

  // dish_viewed fires on the dish page most diners reach, not only on DishDetail.
  useEffect(() => {
    if (!loadedDish || lastViewedDishId.current === loadedDish.id) return;
    lastViewedDishId.current = loadedDish.id;
    trackAnalyticsEvent("dish_viewed", {
      dish_id: loadedDish.id,
      venue_id: loadedDish.venueId,
      source: "catalog_detail",
    });
  }, [loadedDish]);

  // Deep links can open this screen with no history; never leave a dead end.
  const goBackOrHome = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("MainTabs", { screen: "Discover" });
  }, [navigation]);

  // push (not navigate): React Navigation 7 would otherwise update this
  // CatalogRawDetail entry in place and Back would skip the previous record.
  const openRecord = useCallback(
    (kind: "dish" | "venue", id: string, releaseId?: string) => {
      navigation.push("CatalogRawDetail", { kind, id, releaseId });
    },
    [navigation],
  );

  const loadMoreMenu = useCallback(async () => {
    if (!service || !menu?.nextCursor || isLoadingMoreMenu) return;
    const startedAt = Date.now();
    setIsLoadingMoreMenu(true);
    setMenuError(null);
    try {
      const nextPage = await service.listVenueMenu(route.params.id, {
        cursor: menu.nextCursor,
        limit: VENUE_MENU_PAGE_SIZE,
        releaseId: menu.releaseId,
      });
      setMenu((current) =>
        current
          ? {
              ...nextPage,
              items: appendUniqueById(current.items, nextPage.items),
            }
          : nextPage,
      );
      recordCatalogDiagnostic({
        operation: "venue-menu",
        durationMs: Date.now() - startedAt,
        releaseId: nextPage.releaseId,
        resultCount: nextPage.items.length,
        succeeded: true,
        request: summarizeCatalogRequest({ releaseId: menu.releaseId, cursor: menu.nextCursor }),
      });
    } catch (loadError) {
      reportError(loadError, { screen: "CatalogRawDetail", action: "loadMoreMenu" });
      setMenuError(
        loadError instanceof Error ? loadError.message : "Couldn't load more menu items.",
      );
      recordCatalogDiagnostic({
        operation: "venue-menu",
        durationMs: Date.now() - startedAt,
        errorKind:
          loadError instanceof CatalogAccessError
            ? loadError.kind
            : loadError instanceof Error
              ? loadError.name
              : "unknown",
        resultCount: 0,
        succeeded: false,
        request: summarizeCatalogRequest({ releaseId: menu.releaseId, cursor: menu.nextCursor }),
      });
    } finally {
      setIsLoadingMoreMenu(false);
    }
  }, [isLoadingMoreMenu, menu, route.params.id, service]);

  const handleToggleFavourite = async (dish: CatalogRawDishDetail) => {
    setIsSavingFavourite(true);
    try {
      // Toast only after the authenticated write settles so failures are never hidden.
      const result = await toggleFavourite(
        { id: dish.id, venueId: dish.venueId },
        { surface: "catalog_detail" },
      );
      if (result.status === "failed") {
        showToast({ message: result.message, tone: "error" });
        return;
      }
      showToast({
        message: result.status === "saved" ? "Saved to favourites." : "Removed from favourites.",
        tone: "success",
      });
    } finally {
      setIsSavingFavourite(false);
    }
  };

  const load = useCallback(async () => {
    const startedAt = Date.now();
    if (!isAuthenticated) {
      setError("Sign in to view this catalog record.");
      setIsLoading(false);
      recordCatalogDiagnostic({
        operation: isDish ? "dish-detail" : "stall-detail",
        durationMs: Date.now() - startedAt,
        errorKind: "authentication_required",
        resultCount: 0,
        succeeded: false,
        request: summarizeCatalogRequest({ releaseId: route.params.releaseId }),
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    setMenuError(null);
    try {
      const next = isDish
        ? await service.getDish(route.params.id, route.params.releaseId)
        : await service.getVenue(route.params.id, route.params.releaseId);
      setDetail(next);
      recordCatalogDiagnostic({
        operation: isDish ? "dish-detail" : "stall-detail",
        durationMs: Date.now() - startedAt,
        releaseId: route.params.releaseId,
        resultCount: 1,
        succeeded: true,
        request: summarizeCatalogRequest({ releaseId: route.params.releaseId }),
      });
      if (!isDish) {
        const menuPage = await service.listVenueMenu(route.params.id, {
          limit: VENUE_MENU_PAGE_SIZE,
          releaseId: route.params.releaseId,
        });
        setMenu(menuPage);
        recordCatalogDiagnostic({
          operation: "venue-menu",
          durationMs: Date.now() - startedAt,
          releaseId: menuPage.releaseId,
          resultCount: menuPage.items.length,
          succeeded: true,
          request: summarizeCatalogRequest({ releaseId: route.params.releaseId }),
        });
      } else {
        setMenu(null);
      }
    } catch (loadError) {
      reportError(loadError, {
        screen: "CatalogRawDetail",
        action: "load",
        kind: route.params.kind,
      });
      // Raw service errors are not user copy.
      setError("load_failed");
      recordCatalogDiagnostic({
        operation: isDish ? "dish-detail" : "stall-detail",
        durationMs: Date.now() - startedAt,
        errorKind:
          loadError instanceof CatalogAccessError
            ? loadError.kind
            : loadError instanceof Error
              ? loadError.name
              : "unknown",
        resultCount: 0,
        succeeded: false,
        request: summarizeCatalogRequest({ releaseId: route.params.releaseId }),
      });
    } finally {
      setIsLoading(false);
    }
  }, [isDish, route.params.id, route.params.kind, route.params.releaseId, service]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <DetailHeader onBack={goBackOrHome} />
        <View
          accessibilityLabel="Loading catalog record"
          style={{ gap: spacing[4], padding: spacing[4] }}
        >
          <Skeleton width="100%" height={260} borderRadius={0} />
          <Skeleton width="70%" height={28} />
          <ActivityIndicator color={palette.orange} />
        </View>
      </Screen>
    );
  }

  if (!detail || error) {
    return (
      <Screen scroll={false}>
        <DetailHeader onBack={goBackOrHome} />
        <EmptyState
          title={error ? "Couldn't load this listing" : "Listing not found"}
          body={
            error
              ? "Check your connection and try again."
              : "This listing isn't in the current catalog."
          }
          ctaLabel="Retry"
          onPress={() => void load()}
        />
      </Screen>
    );
  }

  const images = isDish
    ? (detail as CatalogRawDishDetail).media
        // Only photos with approved display rights, as on Discover.
        .filter((media) => media.approvedForDisplay)
        .map((media) => media.url)
        .filter(Boolean)
    : [detail.imageUrl].filter((value): value is string => Boolean(value));
  const sourceUrl = detail.menuSourceUrl ?? detail.mediaSourceUrl;
  const venueDetail = isDish ? null : (detail as CatalogRawVenueDetail);
  const venueAddress = venueDetail
    ? [venueDetail.address, venueDetail.postalCode].filter(Boolean).join(" ")
    : "";
  const venueHours = venueDetail?.operatingHours;

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[8] }}>
        <DetailHeader title={detail.name} onBack={goBackOrHome} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2], paddingHorizontal: spacing[4] }}
        >
          {images.length ? (
            images.map((url, index) => (
              <AccessibleImage
                key={`${url}-${index}`}
                source={{ uri: url }}
                style={{ backgroundColor: palette.bgSoft, height: 250, width: 300 }}
                contentFit="cover"
                accessibilityLabel={`${detail.name} image`}
              />
            ))
          ) : (
            <View
              style={{
                alignItems: "center",
                backgroundColor: palette.bgSoft,
                height: 250,
                justifyContent: "center",
                width: 300,
              }}
            >
              <AppText tone="muted">Image unavailable</AppText>
            </View>
          )}
        </ScrollView>
        <View style={{ gap: spacing[3], paddingHorizontal: spacing[4] }}>
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: palette.bgSoft,
              borderRadius: 999,
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[1],
            }}
          >
            <AppText tone="secondary" variant="micro">
              {statusLabel(detail.verificationStatus)}
            </AppText>
          </View>
          {isDish ? (
            <>
              {(detail as CatalogRawDishDetail).venueId ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Open stall ${(detail as CatalogRawDishDetail).venueName}`}
                  accessibilityHint="Opens this stall's menu"
                  hitSlop={8}
                  onPress={() =>
                    openRecord(
                      "venue",
                      (detail as CatalogRawDishDetail).venueId,
                      route.params.releaseId,
                    )
                  }
                  style={{ alignSelf: "flex-start" }}
                >
                  <AppText style={{ color: palette.orange, textDecorationLine: "underline" }}>
                    {(detail as CatalogRawDishDetail).venueName}
                  </AppText>
                </Pressable>
              ) : (
                <AppText tone="secondary">{(detail as CatalogRawDishDetail).venueName}</AppText>
              )}
              {(detail as CatalogRawDishDetail).price !== undefined ? (
                <AppText style={{ color: palette.orange }} variant="h2">
                  S${(detail as CatalogRawDishDetail).price?.toFixed(2)}
                </AppText>
              ) : null}
            </>
          ) : (
            <AppText tone="secondary">
              {(detail as CatalogRawVenueDetail).menuCount} listed dishes
            </AppText>
          )}
          {isDish && FEATURE_FLAGS.favouritesEnabled ? (
            <Button
              label={isFavourite ? "Remove from favourites" : "Save to favourites"}
              variant={isFavourite ? "secondary" : "primary"}
              loading={isSavingFavourite}
              leftIcon={
                <Heart
                  color={isFavourite ? palette.error : palette.white}
                  fill={isFavourite ? palette.error : "transparent"}
                  size={18}
                />
              }
              onPress={() => void handleToggleFavourite(detail as CatalogRawDishDetail)}
            />
          ) : null}
          {showSaveToList ? (
            <Button
              label="Save to list"
              variant="secondary"
              loading={isAddingToPortfolio}
              accessibilityHint="Opens your lists to add this dish to one"
              leftIcon={<ListPlus color={palette.text} size={18} />}
              onPress={() => void addToPortfolio()}
            />
          ) : null}
          {"description" in detail && detail.description ? (
            <AppText>{detail.description}</AppText>
          ) : null}
          {!isDish && menu ? (
            <View style={{ gap: spacing[2] }}>
              <AppText variant="bodyBold">Menu</AppText>
              {menu.items.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityLabel={`Open ${item.name}`}
                  accessibilityRole="button"
                  onPress={() => openRecord("dish", item.id, menu.releaseId)}
                  style={{
                    backgroundColor: palette.bgSoft,
                    borderRadius: 12,
                    gap: spacing[1],
                    padding: spacing[3],
                  }}
                >
                  <AppText variant="bodySmallBold">{item.name}</AppText>
                  <AppText tone="secondary" variant="micro">
                    {item.price !== undefined ? `S$${item.price.toFixed(2)}` : "Price unavailable"}
                  </AppText>
                </Pressable>
              ))}
              {menuError ? (
                <AppText accessibilityLiveRegion="polite" tone="secondary" variant="bodySmall">
                  {"Couldn't load more menu items."}
                </AppText>
              ) : null}
              {menu.nextCursor ? (
                <Button
                  label={menuError ? "Retry" : "Show more dishes"}
                  variant="secondary"
                  loading={isLoadingMoreMenu}
                  onPress={() => void loadMoreMenu()}
                />
              ) : null}
            </View>
          ) : null}
          {/* The building appears once, with the address under it when the catalog has one. */}
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <MapPin color={palette.textMuted} size={18} />
            <View style={{ flex: 1, gap: spacing[0.5] }}>
              <AppText tone="muted" variant="bodySmall">
                {detail.buildingName ?? "Singapore"}
              </AppText>
              {venueAddress ? (
                <AppText tone="muted" variant="bodySmall">
                  {venueAddress}
                </AppText>
              ) : null}
            </View>
          </View>
          {venueHours ? (
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <Clock color={palette.textMuted} size={18} />
              <AppText tone="muted" variant="bodySmall" style={{ flex: 1 }}>
                {venueHours}
              </AppText>
            </View>
          ) : null}
          {sourceUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Open the source page"
              onPress={() => void openMerchantProfileLink("web", sourceUrl)}
              style={{ alignItems: "center", flexDirection: "row", gap: spacing[2], minHeight: 44 }}
            >
              <ExternalLink color={palette.textMuted} size={18} />
              <AppText tone="accent" variant="bodySmall" numberOfLines={1} style={{ flex: 1 }}>
                Source: {sourceHost(sourceUrl)}
              </AppText>
            </Pressable>
          ) : null}
          <Button
            label="Open stall page"
            variant="secondary"
            onPress={() =>
              navigation.navigate("StallDetail", {
                venueId: isDish ? (detail as CatalogRawDishDetail).venueId : detail.id,
              })
            }
          />
          {isDish && detail.verificationStatus === "approved" ? (
            <Button
              label="Open dish page"
              variant="secondary"
              onPress={() => navigation.navigate("DishDetail", { dishId: detail.id })}
            />
          ) : null}
        </View>
      </ScrollView>
      {showSaveToList ? saveToListSheet : null}
    </Screen>
  );
}
