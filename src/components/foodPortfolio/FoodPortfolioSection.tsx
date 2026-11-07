import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { AccessibleImage, AppSymbol, AppText, Button, EmptyState } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import {
  FOOD_PORTFOLIO_MAX_PINS,
  portfolioPostImage,
} from "@/features/foodPortfolio/foodPortfolioLoaders";
import { useFoodPortfolio } from "@/features/foodPortfolio/useFoodPortfolio";
import { trackAnalyticsEvent } from "@/lib/analytics";
import type { Bite } from "@/lib/services/types";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type FoodPortfolioSectionProps = {
  userId: string;
  ownerName: string;
  isSelf: boolean;
  /** Root navigation: post detail, stall pages and the composer are root routes. */
  navigation: { navigate: (...args: any[]) => void };
  /** Bump to refetch (your own grid after posting or deleting). */
  reloadKey?: number;
  /** The dishes-posted count for a profile's stat row: null while loading, "20+" with more pages. */
  onPostCountChange?: (count: number | string | null) => void;
};

type PortfolioTab = "dishes" | "stalls";

/** "1 dish", "2 dishes". */
export function dishWord(count: number): string {
  return count === 1 ? "dish" : "dishes";
}

function PostTile({
  post,
  label,
  onPress,
  selectedIndex,
  testID,
}: {
  post: Bite;
  label: string;
  onPress?: () => void;
  /** 0-based pin position while choosing the top three. */
  selectedIndex?: number;
  testID?: string;
}) {
  const { palette, radii } = useHungryTheme();
  const image = portfolioPostImage(post);
  const tile = (
    <View style={{ flex: 1, backgroundColor: palette.bgSoft }}>
      {image ? (
        <AccessibleImage
          decorative
          source={{ uri: image }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <AppSymbol name="dish" size={24} color={palette.textMuted} />
        </View>
      )}
      {selectedIndex !== undefined ? (
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            minWidth: 24,
            height: 24,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.orange,
          }}
        >
          <AppText variant="micro" style={{ color: palette.textOnOrange, fontWeight: "700" }}>
            {selectedIndex + 1}
          </AppText>
        </View>
      ) : null}
    </View>
  );
  if (!onPress) return tile;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selectedIndex !== undefined ? { selected: true } : undefined}
      onPress={onPress}
      testID={testID}
      style={{ flex: 1 }}
    >
      {tile}
    </Pressable>
  );
}

/**
 * The Food Portfolio on a profile: the top three dishes, then every dish posted (a three-column
 * grid) or the stalls they were posted from. Yours adds Post a dish and Edit top three.
 */
export function FoodPortfolioSection({
  userId,
  ownerName,
  isSelf,
  navigation,
  reloadKey = 0,
  onPostCountChange,
}: FoodPortfolioSectionProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const portfolio = useFoodPortfolio(userId, FEATURE_FLAGS.foodPortfolioEnabled, reloadKey);
  const [tab, setTab] = useState<PortfolioTab>("dishes");
  const [pinDraft, setPinDraft] = useState<string[] | null>(null);
  const [isSavingPins, setIsSavingPins] = useState(false);
  const postCount =
    portfolio.postsState === "loaded"
      ? portfolio.hasMorePosts
        ? `${portfolio.posts.length}+`
        : portfolio.posts.length
      : portfolio.postsState === "failed"
        ? "–"
        : null;
  useEffect(() => {
    onPostCountChange?.(postCount);
  }, [onPostCountChange, postCount]);

  if (!FEATURE_FLAGS.foodPortfolioEnabled) return null;

  const openPost = (post: Bite, source: "top_three" | "grid") => {
    trackAnalyticsEvent("profile_item_opened", {
      kind: "post",
      source: `food_portfolio_${source}`,
    });
    navigation.navigate("ActivityPostDetail", { postId: post.id });
  };
  const openComposer = () => {
    trackAnalyticsEvent("food_portfolio_post_tapped", { source: "portfolio" });
    navigation.navigate("Post");
  };
  const togglePin = (postId: string) => {
    setPinDraft((current) => {
      const draft = current ?? [];
      if (draft.includes(postId)) return draft.filter((id) => id !== postId);
      if (draft.length >= FOOD_PORTFOLIO_MAX_PINS) {
        showToast({ message: "Pick up to three dishes.", tone: "info" });
        return draft;
      }
      return [...draft, postId];
    });
  };
  const savePins = async () => {
    if (!pinDraft) return;
    setIsSavingPins(true);
    const saved = await portfolio.savePins(pinDraft);
    setIsSavingPins(false);
    if (saved) {
      setPinDraft(null);
      showToast({ message: "Top three updated.", tone: "success" });
    } else {
      showToast({ message: "Couldn't save your top three. Try again.", tone: "error" });
    }
  };

  const dishCount = portfolio.postsState === "loaded" ? portfolio.posts.length : null;
  const dishCountLabel =
    dishCount === null
      ? ""
      : `${portfolio.hasMorePosts ? `${dishCount}+` : dishCount} ${dishWord(dishCount)}`;
  const isChoosingPins = pinDraft !== null;

  const tabButton = (key: PortfolioTab, label: string) => {
    const selected = tab === key;
    return (
      <Pressable
        key={key}
        accessibilityRole="tab"
        accessibilityLabel={`Show ${label.toLowerCase()}`}
        accessibilityState={{ selected }}
        onPress={() => setTab(key)}
        style={{
          flex: 1,
          minHeight: 36,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radii.pill,
          backgroundColor: selected ? palette.surface : "transparent",
        }}
      >
        <AppText variant="bodySmall" style={{ fontWeight: selected ? "700" : "500" }}>
          {label}
        </AppText>
      </Pressable>
    );
  };

  const grid = (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing[4] }}
      testID="food-portfolio-grid"
    >
      {portfolio.posts.map((post) => {
        const pinIndex = pinDraft?.indexOf(post.id);
        const dishName = post.dishName || "dish";
        return (
          <View key={post.id} style={{ width: "33.333%", aspectRatio: 1, padding: 1 }}>
            <PostTile
              post={post}
              label={
                isChoosingPins
                  ? `${pinIndex !== undefined && pinIndex >= 0 ? "Unpin" : "Pin"} ${dishName}`
                  : `Open ${dishName} at ${post.venueName || "this stall"}`
              }
              selectedIndex={pinIndex !== undefined && pinIndex >= 0 ? pinIndex : undefined}
              onPress={isChoosingPins ? () => togglePin(post.id) : () => openPost(post, "grid")}
              testID={`food-portfolio-tile-${post.id}`}
            />
          </View>
        );
      })}
    </View>
  );

  const dishesBody =
    portfolio.postsState === "loading" && portfolio.posts.length === 0 ? (
      <View testID="food-portfolio-loading" style={{ minHeight: 120 }} />
    ) : portfolio.postsState === "failed" && portfolio.posts.length === 0 ? (
      <EmptyState
        title="Couldn't load dishes"
        body="Check your connection and try again."
        icon={<AppSymbol name="noPosts" size={36} weight="regular" color={palette.textSecondary} />}
        ctaLabel="Retry"
        onPress={portfolio.retry}
      />
    ) : portfolio.posts.length === 0 ? (
      <EmptyState
        title={isSelf ? "Post your first dish" : "No dishes yet"}
        body={
          isSelf
            ? "Snap what you eat. Every dish you post builds your Food Portfolio."
            : `${ownerName} hasn't posted a dish yet.`
        }
        icon={<AppSymbol name="camera" size={36} weight="regular" color={palette.textSecondary} />}
        ctaLabel={isSelf ? "Post a dish" : undefined}
        onPress={isSelf ? openComposer : undefined}
      />
    ) : (
      <>
        {grid}
        {portfolio.hasMorePosts ? (
          <Button
            label="Load more"
            variant="ghost"
            size="sm"
            loading={portfolio.isLoadingMore}
            onPress={portfolio.loadMore}
          />
        ) : null}
      </>
    );

  const stallsBody =
    portfolio.stallsState === "loading" ? (
      <View style={{ minHeight: 120 }} />
    ) : portfolio.stallsState === "failed" ? (
      <EmptyState
        title="Couldn't load stalls"
        body="Check your connection and try again."
        icon={<AppSymbol name="stall" size={36} weight="regular" color={palette.textSecondary} />}
        ctaLabel="Retry"
        onPress={portfolio.retry}
      />
    ) : portfolio.stalls.length === 0 ? (
      <EmptyState
        title="No stalls yet"
        body={
          isSelf
            ? "Stalls show here once you post a dish from them."
            : `Stalls show here once ${ownerName} posts a dish.`
        }
        icon={<AppSymbol name="stall" size={36} weight="regular" color={palette.textSecondary} />}
      />
    ) : (
      <View
        style={{ borderRadius: componentRadii.card, backgroundColor: palette.surface }}
        testID="food-portfolio-stalls"
      >
        {portfolio.stalls.map((stall, index) => (
          <Pressable
            key={stall.venueId}
            accessibilityRole="button"
            accessibilityLabel={`${stall.venueName}, ${stall.dishCount} ${dishWord(stall.dishCount)} posted`}
            onPress={() => navigation.navigate("StallDetail", { venueId: stall.venueId })}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[3],
              minHeight: 56,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[2],
              backgroundColor: pressed ? palette.bgSoft : "transparent",
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: palette.border,
            })}
          >
            <AppSymbol name="stall" size={20} color={palette.textSecondary} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyBold" numberOfLines={1}>
                {stall.venueName}
              </AppText>
              {stall.buildingName ? (
                <AppText variant="micro" tone="secondary" numberOfLines={1}>
                  {stall.buildingName}
                </AppText>
              ) : null}
            </View>
            <AppText variant="bodySmall" tone="secondary">
              {stall.dishCount} {dishWord(stall.dishCount)}
            </AppText>
            <AppSymbol name="chevronRight" size={14} color={palette.textMuted} />
          </Pressable>
        ))}
      </View>
    );

  return (
    <View style={{ gap: spacing[3] }} testID="food-portfolio-section">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <AppText variant="h2">Food Portfolio</AppText>
          {dishCountLabel ? (
            <AppText variant="micro" tone="secondary" testID="food-portfolio-count">
              {dishCountLabel}
            </AppText>
          ) : null}
        </View>
        {isSelf ? (
          <Button
            label="Post a dish"
            size="sm"
            fullWidth={false}
            leftIcon={<AppSymbol name="camera" size={16} color={palette.textOnOrange} />}
            onPress={openComposer}
            style={{ minHeight: 44 }}
          />
        ) : null}
      </View>

      {portfolio.topPosts.length > 0 && !isChoosingPins ? (
        <View style={{ gap: spacing[2] }} testID="food-portfolio-top-three">
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <AppText variant="h3">Top three</AppText>
            {isSelf && portfolio.posts.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit top three"
                accessibilityHint="Pick up to three of your dishes to show first"
                hitSlop={8}
                onPress={() => {
                  setTab("dishes");
                  setPinDraft(portfolio.pinnedPostIds);
                }}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <AppText variant="bodySmall" style={{ color: palette.accentText }}>
                  Edit
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            {portfolio.topPosts.map((post) => (
              <View
                key={post.id}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  borderRadius: componentRadii.card,
                  overflow: "hidden",
                }}
              >
                <PostTile
                  post={post}
                  label={`Open ${post.dishName || "dish"} at ${post.venueName || "this stall"}`}
                  onPress={() => openPost(post, "top_three")}
                  testID={`food-portfolio-top-${post.id}`}
                />
              </View>
            ))}
            {/* Keep three equal columns when fewer than three dishes exist. */}
            {Array.from({ length: FOOD_PORTFOLIO_MAX_PINS - portfolio.topPosts.length }).map(
              (_, index) => (
                <View key={`spacer-${index}`} style={{ flex: 1 }} />
              ),
            )}
          </View>
        </View>
      ) : null}

      {isChoosingPins ? (
        <View
          testID="food-portfolio-pin-bar"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2],
            padding: spacing[3],
            borderRadius: componentRadii.card,
            backgroundColor: palette.orangeLight,
          }}
        >
          <AppText variant="bodySmall" style={{ flex: 1 }}>
            {`Tap up to three dishes to show first (${pinDraft?.length ?? 0} of ${FOOD_PORTFOLIO_MAX_PINS}).`}
          </AppText>
          <Button
            label="Cancel"
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => setPinDraft(null)}
          />
          <Button
            label="Save"
            size="sm"
            fullWidth={false}
            loading={isSavingPins}
            onPress={() => void savePins()}
          />
        </View>
      ) : (
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: "row",
            padding: 2,
            borderRadius: radii.pill,
            backgroundColor: palette.bgSoft,
          }}
        >
          {tabButton("dishes", "Dishes")}
          {tabButton("stalls", "Stalls")}
        </View>
      )}

      {tab === "dishes" || isChoosingPins ? dishesBody : stallsBody}
    </View>
  );
}
