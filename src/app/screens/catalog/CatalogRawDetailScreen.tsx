import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, ExternalLink, Heart, MapPin } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AccessibleImage, AppText, Button, EmptyState, Screen, Skeleton } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getCatalogRawService, getServiceProvider } from "@/lib/services/serviceProvider";
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
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "CatalogRawDetail">;
type Detail = CatalogRawDishDetail | CatalogRawVenueDetail;

function statusLabel(status: Detail["verificationStatus"]) {
  return status === "approved"
    ? "Approved source"
    : status === "verified"
      ? "Source verified"
      : "Unverified source";
}

export function CatalogRawDetailScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
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

  const handleToggleFavourite = async (dish: CatalogRawDishDetail) => {
    setIsSavingFavourite(true);
    try {
      // Toast only after the authenticated write settles so failures are never hidden.
      const result = await toggleFavourite({ id: dish.id, venueId: dish.venueId });
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
    if (!service || !isAuthenticated || getServiceProvider().mode === "mock") {
      setError("Sign in with the live Hungry data source to view this catalog record.");
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
          limit: 24,
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
      setError(
        loadError instanceof Error ? loadError.message : "Could not load this catalog record.",
      );
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
  }, [isAuthenticated, isDish, route.params.id, route.params.releaseId, service]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <View style={{ gap: spacing[4], padding: spacing[4] }}>
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
        <EmptyState
          title="Catalog record unavailable"
          body={error ?? "This record was not found in the active catalog release."}
          ctaLabel="Retry"
          onPress={() => void load()}
        />
      </Screen>
    );
  }

  const images = isDish
    ? (detail as CatalogRawDishDetail).media.map((media) => media.url).filter(Boolean)
    : [detail.imageUrl].filter((value): value is string => Boolean(value));
  const sourceUrl = detail.menuSourceUrl ?? detail.mediaSourceUrl;

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[8] }}>
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
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft color={palette.text} size={24} />
          </Pressable>
          <AppText numberOfLines={1} style={{ flex: 1 }} variant="h2">
            {detail.name}
          </AppText>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2], paddingHorizontal: spacing[4] }}
        >
          {images.length ? (
            images.map((url) => (
              <AccessibleImage
                key={url}
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
              <AppText tone="secondary">{(detail as CatalogRawDishDetail).venueName}</AppText>
              {(detail as CatalogRawDishDetail).price !== undefined ? (
                <AppText style={{ color: palette.orange }} variant="h2">
                  S${(detail as CatalogRawDishDetail).price?.toFixed(2)}
                </AppText>
              ) : null}
            </>
          ) : (
            <>
              <AppText tone="secondary">
                {(detail as CatalogRawVenueDetail).buildingName ?? "Singapore"}
              </AppText>
              <AppText tone="secondary">
                {(detail as CatalogRawVenueDetail).menuCount} listed dishes
              </AppText>
            </>
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
                  onPress={() =>
                    navigation.navigate("CatalogRawDetail", {
                      kind: "dish",
                      id: item.id,
                      releaseId: menu.releaseId,
                    })
                  }
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
              {menu.nextCursor ? (
                <AppText tone="muted" variant="micro">
                  More menu items are available in this catalog release.
                </AppText>
              ) : null}
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <MapPin color={palette.textMuted} size={18} />
            <AppText tone="muted" variant="bodySmall">
              {detail.buildingName ?? "Singapore"}
            </AppText>
          </View>
          {sourceUrl ? (
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <ExternalLink color={palette.textMuted} size={18} />
              <AppText tone="muted" variant="bodySmall" numberOfLines={1}>
                {sourceUrl}
              </AppText>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
