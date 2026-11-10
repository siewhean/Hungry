import { useState } from "react";
import { Pressable, View } from "react-native";

import {
  AccessibleImage,
  AppSymbol,
  AppText,
  Button,
  EmptyState,
  SegmentedControl,
} from "@/components/ui";
import { ProfileStatRow, STAT_UNAVAILABLE } from "@/components/profile/ProfileStatRow";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import {
  FOOD_PORTFOLIO_MAX_PINS,
  portfolioPostImage,
} from "@/features/foodPortfolio/foodPortfolioLoaders";
import {
  dishTypeWords,
  entryActionSheet,
  topThreePlaceOptions,
  type PortfolioEntryAction,
} from "@/features/foodPortfolio/portfolioEntryActions";
import { FoodPortfolioShareSheet } from "@/components/foodPortfolio/FoodPortfolioShareSheet";
import { PortfolioEmptyIllustration } from "@/components/icons/food/SocialIllustrations";
import { portfolioCardPhotos, portfolioCardStatLine } from "@/features/foodPortfolio/shareCards";
import { useFoodPortfolio } from "@/features/foodPortfolio/useFoodPortfolio";
import { useBoardRank } from "@/features/leaderboard/boardRanks";
import { trackAnalyticsEvent } from "@/lib/analytics";
import type { Bite, PortfolioDiaryEntry } from "@/lib/services/types";
import { askChoice } from "@/store/useChoiceSheetStore";
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
};

type PortfolioTab = "diary" | "stalls";

/** "1 dish", "2 dishes". */
export function dishWord(count: number): string {
  return count === 1 ? "dish" : "dishes";
}

function PostTile({
  post,
  label,
  onPress,
  onLongPress,
  selectedIndex,
  onlyMe = false,
  testID,
}: {
  post: Bite;
  label: string;
  onPress?: () => void;
  /** The owner's entry actions (also offered to screen readers). */
  onLongPress?: () => void;
  /** 0-based top three place, shown as a number. */
  selectedIndex?: number;
  /** An Only me entry: shows a lock. */
  onlyMe?: boolean;
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
      {onlyMe ? (
        <View
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            width: 24,
            height: 24,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.surface,
          }}
        >
          <AppSymbol name="profilePrivate" size={13} color={palette.textSecondary} />
        </View>
      ) : null}
    </View>
  );
  if (!onPress) return tile;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={
        onLongPress ? [{ name: "longpress", label: "Picks and who can see it" }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "longpress") onLongPress?.();
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      style={{ flex: 1 }}
    >
      {tile}
    </Pressable>
  );
}

/** A dotted top-three slot on your own Portfolio: tap it to start choosing from the diary. */
function EmptyPinSlot({ onPress, index }: { onPress: () => void; index: number }) {
  const { componentRadii, palette } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pick dish ${index + 1} of your top three`}
      onPress={onPress}
      testID={`food-portfolio-top-empty-${index}`}
      style={({ pressed }) => ({
        alignItems: "center",
        aspectRatio: 1,
        backgroundColor: pressed ? palette.bgSoft : "transparent",
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderStyle: "dashed",
        borderWidth: 1.5,
        flex: 1,
        justifyContent: "center",
      })}
    >
      <AppSymbol name="add" size={22} color={palette.textMuted} />
    </Pressable>
  );
}

/**
 * The Food Portfolio on a profile: Dishes, Stalls and Rank (which opens the Leaderboard), the top
 * three, the bests by dish type, then the diary of every dish (a three-column grid) or the stalls
 * they came from. Yours adds Share, Post a dish, Only me entries (with a lock) and, under Edit, a
 * sheet on each entry: make it your best of its dish type, put it in the top three, or Only me.
 */
export function FoodPortfolioSection({
  userId,
  ownerName,
  isSelf,
  navigation,
  reloadKey = 0,
}: FoodPortfolioSectionProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const portfolio = useFoodPortfolio(userId, FEATURE_FLAGS.foodPortfolioEnabled, reloadKey);
  const [tab, setTab] = useState<PortfolioTab>("diary");
  const [isEditing, setIsEditing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const boardRank = useBoardRank(userId, isSelf, FEATURE_FLAGS.foodPortfolioEnabled);

  if (!FEATURE_FLAGS.foodPortfolioEnabled) return null;

  const { entries, picks } = portfolio;
  const topPosts = picks.topThree.map((pick) => pick.post);
  const publicPosts = entries.filter((entry) => entry.visibility !== "private").map((e) => e.post);
  const postCount =
    portfolio.entriesState === "loaded"
      ? portfolio.hasMoreEntries
        ? `${entries.length}+`
        : entries.length
      : portfolio.entriesState === "failed"
        ? STAT_UNAVAILABLE
        : null;

  const openPost = (post: Bite, source: "top_three" | "bests" | "grid") => {
    trackAnalyticsEvent("profile_item_opened", {
      kind: "post",
      source: `food_portfolio_${source}`,
    });
    navigation.navigate("ActivityPostDetail", { postId: post.id });
  };
  const openLeaderboard = () => {
    trackAnalyticsEvent("leaderboard_opened", {
      source: isSelf ? "own_portfolio" : "portfolio",
    });
    navigation.navigate("Leaderboard");
  };
  const openComposer = () => {
    trackAnalyticsEvent("food_portfolio_post_tapped", { source: "portfolio" });
    navigation.navigate("Post");
  };

  const runChange = async (
    entry: PortfolioDiaryEntry,
    action: PortfolioEntryAction,
    place?: number,
  ) => {
    const done = await portfolio.changeEntry(entry, action, place);
    if (!done) {
      showToast({ message: "Couldn't save that. Try again.", tone: "error" });
      return;
    }
    const foodType = entry.dishFoodType ? dishTypeWords(entry.dishFoodType) : "dish";
    const messages: Record<PortfolioEntryAction, string> = {
      best: `Now your best ${foodType}.`,
      remove_best: `No longer your best ${foodType}.`,
      top_three: `Now #${place} in your top three.`,
      remove_top_three: "Taken out of your top three.",
      private: "Only you can see this dish now.",
      public: "This dish is public again.",
    };
    showToast({ message: messages[action], tone: "success" });
  };

  const openEntryActions = async (entry: PortfolioDiaryEntry) => {
    const sheet = entryActionSheet(entry, picks);
    const choice = (await askChoice(sheet)) as PortfolioEntryAction | null;
    if (!choice) return;
    if (choice === "top_three") {
      const place = await askChoice({
        title: "Which place?",
        options: topThreePlaceOptions(entry, picks),
      });
      if (!place) return;
      await runChange(entry, "top_three", Number(place));
      return;
    }
    await runChange(entry, choice);
  };

  const startChoosing = () => {
    setTab("diary");
    setIsEditing(true);
    showToast({ message: "Tap a dish in your diary to pick it.", tone: "info" });
  };

  const stallCount =
    portfolio.stallsState === "loaded"
      ? portfolio.stalls.length
      : portfolio.stallsState === "failed"
        ? STAT_UNAVAILABLE
        : null;
  const rankValue =
    boardRank.state === "loaded"
      ? boardRank.rank
        ? `#${boardRank.rank}`
        : STAT_UNAVAILABLE
      : boardRank.state === "failed"
        ? STAT_UNAVAILABLE
        : null;
  const stats = [
    {
      key: "dishes",
      label: postCount === 1 ? "Dish" : "Dishes",
      value: postCount,
      accessibilityHint: "Shows the diary of every dish",
      onPress: () => setTab("diary"),
    },
    {
      key: "stalls",
      label: stallCount === 1 ? "Stall" : "Stalls",
      value: stallCount,
      accessibilityHint: "Shows the stalls these dishes came from",
      onPress: () => setTab("stalls"),
    },
    {
      key: "rank",
      label:
        boardRank.state === "loaded" && boardRank.periodLabel === "all time"
          ? "Rank, all time"
          : "Rank",
      value: rankValue,
      accessibilityHint: "Opens the Leaderboard",
      onPress: openLeaderboard,
    },
  ];
  const hasPublicEntries = publicPosts.length > 0;
  const showTopThree = topPosts.length > 0 || (isSelf && hasPublicEntries);
  const showBests = picks.bests.length > 0;

  const grid = (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing[4] }}
      testID="food-portfolio-grid"
    >
      {entries.map((entry) => {
        const { post } = entry;
        const dishName = post.dishName || "dish";
        const onlyMe = entry.visibility === "private";
        const place = picks.topThree.find((pick) => pick.post.id === post.id)?.place;
        const ownActions = isSelf ? () => void openEntryActions(entry) : undefined;
        return (
          <View key={post.id} style={{ width: "33.333%", aspectRatio: 1, padding: 1 }}>
            <PostTile
              post={post}
              label={
                isEditing
                  ? `Choose for ${dishName}`
                  : `Open ${dishName} at ${post.venueName || "this stall"}${onlyMe ? ", Only me" : ""}`
              }
              onlyMe={onlyMe}
              selectedIndex={isSelf && place ? place - 1 : undefined}
              onPress={isEditing && ownActions ? ownActions : () => openPost(post, "grid")}
              onLongPress={ownActions}
              testID={`food-portfolio-tile-${post.id}`}
            />
          </View>
        );
      })}
    </View>
  );

  const diaryBody =
    portfolio.entriesState === "loading" && entries.length === 0 ? (
      <View testID="food-portfolio-loading" style={{ minHeight: 120 }} />
    ) : portfolio.entriesState === "failed" && entries.length === 0 ? (
      <EmptyState
        title="Couldn't load dishes"
        body="Check your connection and try again."
        icon={<AppSymbol name="noPosts" size={36} weight="regular" color={palette.textSecondary} />}
        ctaLabel="Retry"
        onPress={portfolio.retry}
      />
    ) : entries.length === 0 ? (
      <EmptyState
        title={isSelf ? "Post your first dish" : "No dishes yet"}
        body={
          isSelf
            ? "Snap what you eat. Every dish you post goes in your diary."
            : `${ownerName} hasn't posted a dish yet.`
        }
        icon={<PortfolioEmptyIllustration testID="food-portfolio-empty-art" />}
        ctaLabel={isSelf ? "Post a dish" : undefined}
        onPress={isSelf ? openComposer : undefined}
      />
    ) : (
      <>
        {grid}
        {isSelf && !isEditing ? (
          <Button
            testID="food-portfolio-post"
            label="Post a dish"
            leftIcon={<AppSymbol name="camera" size={18} color={palette.textOnOrange} />}
            onPress={openComposer}
          />
        ) : null}
        {portfolio.hasMoreEntries ? (
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
        <AppText variant="h2" accessibilityRole="header">
          Food Portfolio
        </AppText>
        {isSelf && hasPublicEntries ? (
          <Pressable
            testID="food-portfolio-share"
            accessibilityRole="button"
            accessibilityLabel="Share your Food Portfolio"
            accessibilityHint="Makes a picture of your dishes to share"
            hitSlop={4}
            onPress={() => setIsSharing(true)}
            style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
          >
            <AppSymbol name="share" size={20} color={palette.accentText} />
          </Pressable>
        ) : null}
      </View>
      <ProfileStatRow stats={stats} testID="food-portfolio-stats" />

      {showTopThree ? (
        <View style={{ gap: spacing[2] }} testID="food-portfolio-top-three">
          <AppText variant="h3" accessibilityRole="header">
            Top picks
          </AppText>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            {Array.from({ length: FOOD_PORTFOLIO_MAX_PINS }, (_, index) => {
              const pick = picks.topThree.find((item) => item.place === index + 1);
              if (pick) {
                return (
                  <View
                    key={pick.post.id}
                    style={{
                      flex: 1,
                      aspectRatio: 1,
                      borderRadius: componentRadii.card,
                      overflow: "hidden",
                    }}
                  >
                    <PostTile
                      post={pick.post}
                      label={`Number ${pick.place}: open ${pick.post.dishName || "dish"} at ${pick.post.venueName || "this stall"}`}
                      selectedIndex={index}
                      onPress={() => openPost(pick.post, "top_three")}
                      testID={`food-portfolio-top-${pick.post.id}`}
                    />
                  </View>
                );
              }
              // Three equal columns: yours shows a dotted slot to fill, anyone else's a gap.
              return isSelf ? (
                <EmptyPinSlot key={`empty-${index}`} index={index} onPress={startChoosing} />
              ) : (
                <View key={`spacer-${index}`} style={{ flex: 1 }} />
              );
            })}
          </View>
        </View>
      ) : null}

      {showBests ? (
        <View style={{ gap: spacing[2] }} testID="food-portfolio-bests">
          <AppText variant="h3" accessibilityRole="header">
            {isSelf ? "My bests" : "Bests"}
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {picks.bests.map((best) => (
              <View key={best.foodType} style={{ width: "31%", gap: spacing[1] }}>
                <View
                  style={{
                    aspectRatio: 1,
                    borderRadius: componentRadii.card,
                    overflow: "hidden",
                  }}
                >
                  <PostTile
                    post={best.post}
                    label={`Best ${dishTypeWords(best.foodType)}: open ${best.post.dishName || "dish"} at ${best.post.venueName || "this stall"}`}
                    onPress={() => openPost(best.post, "bests")}
                    testID={`food-portfolio-best-${best.post.id}`}
                  />
                </View>
                <AppText variant="micro" tone="secondary" numberOfLines={2}>
                  {`Best ${dishTypeWords(best.foodType)}`}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <View style={{ flex: 1 }}>
          <SegmentedControl
            testID="food-portfolio-tabs"
            accessibilityLabel="Show the diary or stalls"
            options={[
              { value: "diary", label: "Diary", accessibilityLabel: "Show diary" },
              { value: "stalls", label: "Stalls", accessibilityLabel: "Show stalls" },
            ]}
            value={tab}
            onChange={(value) => {
              setTab(value);
              if (value !== "diary") setIsEditing(false);
            }}
          />
        </View>
        {isSelf && tab === "diary" && entries.length > 0 ? (
          <Pressable
            testID="food-portfolio-edit"
            accessibilityRole="button"
            accessibilityLabel={isEditing ? "Done choosing" : "Edit your picks"}
            accessibilityHint={
              isEditing ? undefined : "Then tap a dish to make it a best or Only me"
            }
            hitSlop={8}
            onPress={() => setIsEditing((value) => !value)}
            style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: spacing[1] }}
          >
            <AppText variant="bodySmall" style={{ color: palette.accentText }}>
              {isEditing ? "Done" : "Edit"}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {isEditing ? (
        <View
          testID="food-portfolio-edit-bar"
          style={{
            padding: spacing[3],
            borderRadius: componentRadii.card,
            backgroundColor: palette.orangeLight,
          }}
        >
          <AppText variant="bodySmall">
            Tap a dish to make it your best of its kind, put it in your top three, or make it Only
            me. Your other dishes stay in the diary.
          </AppText>
        </View>
      ) : null}

      {tab === "diary" ? diaryBody : stallsBody}
      {isSelf && isSharing ? (
        <FoodPortfolioShareSheet
          visible
          onClose={() => setIsSharing(false)}
          card={{
            kind: "portfolio",
            ownerId: userId,
            ownerName,
            // Only me entries never go on a picture meant for others.
            photos: portfolioCardPhotos(topPosts, publicPosts),
            statLine: portfolioCardStatLine(
              publicPosts.length,
              portfolio.stallsState === "loaded" ? portfolio.stalls.length : null,
            ),
          }}
        />
      ) : null}
    </View>
  );
}
