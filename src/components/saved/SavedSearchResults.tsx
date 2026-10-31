import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AppSymbol, AppText, EmptyState, Input, Skeleton } from "@/components/ui";
import type { AppSymbolName } from "@/components/ui";
import {
  SAVED_SEARCH_GROUP_LABELS,
  formatSavedSearchCount,
  type SavedSearchGroup,
} from "@/features/saved/savedSearch";
import { savedDishPlaceLine } from "@/features/saved/savedDishes";
import type { SavedSearchState } from "@/features/saved/useSavedSearch";
import type { SavedDishCard } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";
import type { Portfolio, Review, VenueSummary } from "@/types/domain";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
};

/** The one search box at the top of Saved. */
export function SavedSearchBox({ value, onChangeText }: Props) {
  const { palette } = useHungryTheme();
  return (
    <Input
      placeholder="Search everything you saved"
      accessibilityLabel="Search everything you saved"
      value={value}
      onChangeText={onChangeText}
      returnKeyType="search"
      autoCorrect={false}
      leftIcon={<AppSymbol name="search" color={palette.textMuted} size={18} />}
      rightIcon={
        value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={12}
            onPress={() => onChangeText("")}
          >
            <AppSymbol name="clearSearch" color={palette.textMuted} size={18} />
          </Pressable>
        ) : undefined
      }
    />
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  label,
  onPress,
}: {
  icon: AppSymbolName;
  title: string;
  subtitle?: string;
  label: string;
  onPress: () => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing[3],
        minHeight: 56,
        opacity: pressed ? 0.85 : 1,
        padding: spacing[3],
      })}
    >
      <AppSymbol name={icon} color={palette.orange} size={20} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyBold" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <AppSymbol name="chevronRight" color={palette.textMuted} size={16} />
    </Pressable>
  );
}

type ResultsProps = {
  search: SavedSearchState;
  onOpenDish: (dish: SavedDishCard) => void;
  onOpenStall: (venue: VenueSummary) => void;
  onOpenList: (portfolio: Portfolio) => void;
  onOpenReview: (review: Review) => void;
  onClear: () => void;
  onRetry: () => void;
};

/** Search results grouped by kind (Dishes, Stalls, Lists, Reviews), each with its count. */
export function SavedSearchResults({
  search,
  onOpenDish,
  onOpenStall,
  onOpenList,
  onOpenReview,
  onClear,
  onRetry,
}: ResultsProps) {
  const { spacing } = useHungryTheme();
  const { results } = search;

  if (search.status === "error") {
    return (
      <EmptyState
        title="Couldn't search your saved items"
        body="Check your connection and try again."
        ctaLabel="Retry"
        onPress={onRetry}
      />
    );
  }

  const groups: { key: SavedSearchGroup; count: number; rows: ReactNode[] }[] = [
    {
      key: "dishes",
      count: results.dishes.length,
      rows: results.dishes.map((dish) => (
        <ResultRow
          key={dish.id}
          icon="saved"
          title={dish.name}
          subtitle={[dish.venueName, savedDishPlaceLine(dish)].filter(Boolean).join(" · ")}
          label={`Open ${dish.name}${dish.venueName ? ` at ${dish.venueName}` : ""}`}
          onPress={() => onOpenDish(dish)}
        />
      )),
    },
    {
      key: "stalls",
      count: results.stalls.length,
      rows: results.stalls.map((venue) => (
        <ResultRow
          key={venue.id}
          icon="stall"
          title={venue.name}
          subtitle={[venue.unitNumber?.trim(), venue.buildingName].filter(Boolean).join(" · ")}
          label={`Open ${venue.name}`}
          onPress={() => onOpenStall(venue)}
        />
      )),
    },
    {
      key: "lists",
      count: results.lists.length,
      rows: results.lists.map((match) => (
        <ResultRow
          key={match.portfolio.id}
          icon="folder"
          title={match.portfolio.name}
          subtitle={
            match.matchedItems.length > 0
              ? `Has ${match.matchedItems.slice(0, 3).join(", ")}`
              : `${match.itemCount} ${match.itemCount === 1 ? "item" : "items"}`
          }
          label={`Open list ${match.portfolio.name}`}
          onPress={() => onOpenList(match.portfolio)}
        />
      )),
    },
    {
      key: "reviews",
      count: results.reviews.length,
      rows: results.reviews.map((match) => (
        <ResultRow
          key={match.review.id}
          icon="reviewBubble"
          title={match.dishName ?? match.venueName ?? "Your review"}
          subtitle={[match.dishName ? match.venueName : undefined, match.review.text]
            .filter(Boolean)
            .join(" · ")}
          label={`Open your review of ${match.dishName ?? match.venueName ?? "this dish"}`}
          onPress={() => onOpenReview(match.review)}
        />
      )),
    },
  ];

  if (search.status === "loading" && results.total === 0) {
    return (
      <View accessibilityLabel="Searching your saved items" style={{ gap: spacing[2] }}>
        <Skeleton height={56} />
        <Skeleton height={56} />
      </View>
    );
  }
  if (results.total === 0) {
    return (
      <EmptyState
        title="No matches"
        body={`Nothing you saved or reviewed matches "${search.query}".`}
        ctaLabel="Clear search"
        onPress={onClear}
      />
    );
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <AppText variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
        {formatSavedSearchCount(results.total)}
        {search.status === "loading" ? " so far" : ""}
      </AppText>
      {groups
        .filter((group) => group.count > 0)
        .map((group) => (
          <View key={group.key} style={{ gap: spacing[2] }}>
            <AppText variant="bodyBold" accessibilityRole="header">
              {`${SAVED_SEARCH_GROUP_LABELS[group.key]} (${group.count})`}
            </AppText>
            {group.rows}
          </View>
        ))}
    </View>
  );
}
