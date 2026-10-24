import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { AccessibleImage, AppText, Button, Card } from "@/components/ui";
import { runListMutation } from "@/features/checklistPortfolio/runListMutation";
import { buildMapsSearchUrl } from "@/features/detail/stallLocation";
import { openTrustedMapsUrl } from "@/lib/security/safeLinking";
import { useProfileStore } from "@/store/useProfileStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { PublicPortfolio } from "@/types/domain";
import { reportError } from "@/lib/monitoring/reportError";

type Props = NativeStackScreenProps<RootStackParamList, "PortfolioPublicView">;

export function PortfolioPublicViewScreen({ navigation, route }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const portfolioId = route.params.portfolioId;
  const follows = usePortfolioStore((state) => state.follows);
  const followPortfolio = usePortfolioStore((state) => state.followPortfolio);
  const unfollowPortfolio = usePortfolioStore((state) => state.unfollowPortfolio);
  const checkFollowStatus = usePortfolioStore((state) => state.checkFollowStatus);
  const refreshPortfolio = usePortfolioStore((state) => state.refreshPortfolio);
  const ownerId = usePortfolioStore(
    (state) => state.portfolios.find((entry) => entry.id === portfolioId)?.ownerId,
  );
  const profileId = useProfileStore((state) => state.profile.id);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  // Shared links usually come from someone else, often before the friend has
  // signed in, so read through the public RPC instead of the owner's tables.
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  // A network error is not "private now": only a confirmed miss says so, and errors can retry.
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const isFollowing = follows[portfolioId] === true;
  const isOwner = Boolean(ownerId) && ownerId === profileId;
  const followAfterSignIn = route.params.follow === true;

  useEffect(() => {
    let mounted = true;
    setLoadState("loading");
    void getHungryService()
      .portfolio.getPublicPortfolio(portfolioId)
      .then((next) => {
        if (!mounted) return;
        setPortfolio(next);
        setLoadState(next ? "ready" : "missing");
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "PortfolioPublicView", action: "load" });
        if (mounted) setLoadState("error");
      });
    return () => {
      mounted = false;
    };
  }, [portfolioId, reloadKey]);

  // Signed in: know whether the list is already saved (a fresh install has no follows
  // loaded yet) and whose list it is, so the owner is not offered "Save this list".
  useEffect(() => {
    if (!isAuthenticated) return;
    void checkFollowStatus(portfolioId).catch(() => undefined);
    void refreshPortfolio(portfolioId).catch(() => undefined);
  }, [checkFollowStatus, isAuthenticated, portfolioId, refreshPortfolio]);

  const saveList = useCallback(
    () =>
      runListMutation(() => followPortfolio(portfolioId), {
        success: "Saved to your lists",
        failure: "Couldn't save the list.",
      }),
    [followPortfolio, portfolioId],
  );

  // Back from sign-in after tapping Save: finish the save instead of asking for another tap.
  useEffect(() => {
    if (!followAfterSignIn || !isAuthenticated || loadState !== "ready" || isOwner) return;
    navigation.setParams({ follow: undefined });
    if (!isFollowing) void saveList();
  }, [followAfterSignIn, isAuthenticated, isFollowing, isOwner, loadState, navigation, saveList]);

  const handleFollow = () => {
    // Sign-in is asked only when the friend wants to keep the list.
    if (!isAuthenticated) {
      setReturnRoute({ name: "PortfolioPublicView", params: { portfolioId, follow: true } });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }
    if (isFollowing) {
      void runListMutation(() => unfollowPortfolio(portfolioId), {
        success: "Removed from your lists",
        failure: "Couldn't remove the list.",
      });
      return;
    }
    void saveList();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: Math.max(insets.top, spacing[4]) }}
      contentContainerStyle={[styles.content, { gap: spacing[4], padding: spacing[4] }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
        >
          <ArrowLeft color={palette.text} size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="h1">Hungry list</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Shared with you
          </AppText>
        </View>
      </View>

      {!portfolio ? (
        <Card>
          <AppText variant="h3">
            {loadState === "loading"
              ? "Loading list…"
              : loadState === "error"
                ? "Couldn't load this list"
                : "List not found"}
          </AppText>
          {loadState === "missing" ? (
            <AppText variant="bodySmall" tone="secondary">
              It may be private now or no longer on Hungry.
            </AppText>
          ) : null}
          {loadState === "error" ? (
            <>
              <AppText variant="bodySmall" tone="secondary">
                Check your connection and try again.
              </AppText>
              <Button
                label="Retry"
                variant="secondary"
                onPress={() => setReloadKey((key) => key + 1)}
              />
            </>
          ) : null}
        </Card>
      ) : (
        <>
          <Card>
            <AppText variant="h2">{portfolio.name}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {[
                `${portfolio.items.length} pick${portfolio.items.length === 1 ? "" : "s"}`,
                portfolio.ownerDisplayName ? `by ${portfolio.ownerDisplayName}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </AppText>
            {portfolio.description ? (
              <AppText variant="body" tone="secondary">
                {portfolio.description}
              </AppText>
            ) : null}
            {isOwner ? (
              <AppText variant="bodySmallBold" tone="secondary">
                Your list
              </AppText>
            ) : (
              <Button
                label={isFollowing ? "Saved" : "Save this list"}
                variant={isFollowing ? "secondary" : "primary"}
                onPress={handleFollow}
              />
            )}
          </Card>

          {portfolio.items.map((item, index) => (
            <Pressable
              key={`${item.dishId ?? item.stallId}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name}`}
              // The nested "Get directions" link is swallowed by this row for screen readers,
              // so it is offered as an action on the row too.
              accessibilityActions={
                item.mapQuery ? [{ name: "directions", label: "Get directions" }] : undefined
              }
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === "directions" && item.mapQuery) {
                  void openTrustedMapsUrl(buildMapsSearchUrl(item.mapQuery));
                }
              }}
              onPress={() => {
                if (item.dishId) navigation.navigate("DishDetail", { dishId: item.dishId });
                else if (item.stallId)
                  navigation.navigate("StallDetail", { venueId: item.stallId });
              }}
            >
              <Card style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
                {item.imageUrl ? (
                  <AccessibleImage
                    source={{ uri: item.imageUrl }}
                    style={{ borderRadius: radii.sm, height: 64, width: 64 }}
                    contentFit="cover"
                    decorative
                  />
                ) : (
                  <NoDishPhoto
                    dishName={item.name}
                    style={{ borderRadius: radii.sm, height: 64, width: 64 }}
                    iconSize={22}
                  />
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyBold" numberOfLines={1}>
                    {portfolio.type === "ranking" ? `#${index + 1} ` : ""}
                    {item.name}
                    {item.score !== undefined ? ` · ${item.score}/10` : ""}
                  </AppText>
                  {item.itemType === "dish" ? (
                    <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                      {[
                        item.stallName,
                        item.price !== undefined ? `S$${item.price.toFixed(2)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </AppText>
                  ) : null}
                  {item.publicNotes ? (
                    <AppText variant="bodySmall" tone="secondary">
                      {item.publicNotes}
                    </AppText>
                  ) : null}
                  {item.mapQuery ? (
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={`Get directions to ${item.name}`}
                      hitSlop={8}
                      onPress={() => void openTrustedMapsUrl(buildMapsSearchUrl(item.mapQuery!))}
                    >
                      <AppText variant="bodySmallBold" tone="accent">
                        Get directions
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    alignItems: "center",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
  },
});
