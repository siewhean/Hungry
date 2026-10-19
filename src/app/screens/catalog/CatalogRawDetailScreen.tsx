import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, ExternalLink, MapPin } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AccessibleImage, AppText, EmptyState, Screen, Skeleton } from "@/components/ui";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import type { CatalogRawDishDetail, CatalogRawVenueDetail } from "@/lib/services/catalog";
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
  // Read-only catalog record: open to guests. It has no save/like actions.
  const service = getCatalogRawService();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isDish = route.params.kind === "dish";

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = isDish
        ? await service.getDish(route.params.id, route.params.releaseId)
        : await service.getVenue(route.params.id, route.params.releaseId);
      setDetail(next);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load this catalog record.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isDish, route.params.id, route.params.releaseId, service]);

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
          {"description" in detail && detail.description ? (
            <AppText>{detail.description}</AppText>
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
