import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Flag, Plus, Share2 } from "lucide-react-native";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { PortfolioItemRow } from "@/components/portfolio";
import { AppText, Button, Card, Input } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { PortfolioItem } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioDetail">;

function formatPortfolioItemLabel(item: PortfolioItem, labels: Record<string, string>) {
  if (item.dishId) return labels[item.dishId] ?? "Deleted dish";
  if (item.stallId) return labels[item.stallId] ?? "Deleted stall";
  return "Portfolio item";
}

function showPortfolioError(error: unknown) {
  Alert.alert(
    "Portfolio update failed",
    error instanceof Error ? error.message : "Please refresh and try again.",
  );
}

export function PortfolioDetailScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const portfolioId = route.params.portfolioId;
  const {
    portfolios,
    items,
    follows,
    loadPortfolios,
    loadPortfolioItems,
    updatePortfolio,
    publishPortfolio,
    deleteItem,
    reorderItems,
    followPortfolio,
    unfollowPortfolio,
    flagPortfolio,
    conflicts,
    clearConflict,
  } = usePortfolioStore();
  const portfolio = portfolios.find((entry) => entry.id === portfolioId);
  const conflict = conflicts[portfolioId];
  const portfolioItems = items[portfolioId] ?? [];
  const isOwner = portfolio?.ownerId === profile.id;
  const isFollowing = follows[portfolioId] === true;
  const [draftName, setDraftName] = useState(portfolio?.name ?? "");
  const [draftDescription, setDraftDescription] = useState(portfolio?.description ?? "");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadPortfolios();
    void loadPortfolioItems(portfolioId);
  }, [loadPortfolioItems, loadPortfolios, portfolioId]);

  useEffect(() => {
    setDraftName(portfolio?.name ?? "");
    setDraftDescription(portfolio?.description ?? "");
  }, [portfolio?.description, portfolio?.name]);

  useEffect(() => {
    let mounted = true;
    const service = getHungryService();

    async function hydrateLabels() {
      const nextLabels: Record<string, string> = {};
      await Promise.all(
        portfolioItems.map(async (item) => {
          if (item.dishId) {
            const dish = await service.discovery.getDish(item.dishId);
            if (dish) nextLabels[item.dishId] = dish.name;
          }
          if (item.stallId) {
            const venue = await service.discovery.getVenue(item.stallId);
            if (venue) nextLabels[item.stallId] = venue.name;
          }
        }),
      );
      if (mounted) setLabels(nextLabels);
    }

    void hydrateLabels();
    return () => {
      mounted = false;
    };
  }, [portfolioItems]);

  const statsLabel = useMemo(() => {
    const itemCount = portfolioItems.length;
    return `${portfolio?.type ?? "portfolio"} · ${portfolio?.visibility ?? "private"} · ${itemCount} item${itemCount === 1 ? "" : "s"}`;
  }, [portfolio?.type, portfolio?.visibility, portfolioItems.length]);

  const saveMetadata = useCallback(async () => {
    if (!portfolio || !isOwner) return;
    const nextName = draftName.trim();
    const nextDescription = draftDescription.trim();
    if (!nextName) return;
    if (nextName === portfolio.name && nextDescription === (portfolio.description ?? "")) return;
    try {
      await updatePortfolio(portfolio.id, {
        name: nextName,
        description: nextDescription || undefined,
        type: portfolio.type,
        visibility: portfolio.visibility,
      });
    } catch (error) {
      showPortfolioError(error);
    }
  }, [draftDescription, draftName, isOwner, portfolio, updatePortfolio]);

  const moveItem = useCallback(
    async (itemId: string, direction: -1 | 1) => {
      const currentIndex = portfolioItems.findIndex((item) => item.id === itemId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= portfolioItems.length) return;
      const nextIds = portfolioItems.map((item) => item.id);
      const [movedItem] = nextIds.splice(currentIndex, 1);
      nextIds.splice(nextIndex, 0, movedItem);
      try {
        await reorderItems(portfolioId, nextIds);
      } catch (error) {
        showPortfolioError(error);
      }
    },
    [portfolioId, portfolioItems, reorderItems],
  );

  if (!portfolio) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg, padding: spacing[5] }]}>
        <AppText variant="h2">Portfolio not found</AppText>
        <Button
          label="Go back"
          onPress={() => navigation.goBack()}
          style={{ marginTop: spacing[4] }}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
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
          <AppText variant="h1">Hungry Portfolio</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {statsLabel}
          </AppText>
        </View>
      </View>

      {conflict ? (
        <Card>
          <AppText variant="bodyBold">Latest version loaded</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {conflict.message}
          </AppText>
          <Button
            label="Review latest"
            size="sm"
            fullWidth={false}
            variant="secondary"
            onPress={() => clearConflict(portfolioId)}
          />
        </Card>
      ) : null}

      <Card>
        {isOwner ? (
          <>
            <Input
              label="Title"
              value={draftName}
              onChangeText={setDraftName}
              onBlur={saveMetadata}
            />
            <Input
              label="Description"
              value={draftDescription}
              onChangeText={setDraftDescription}
              onBlur={saveMetadata}
              multiline
            />
          </>
        ) : (
          <>
            <AppText variant="h2">{portfolio.name}</AppText>
            {portfolio.description ? (
              <AppText variant="body" tone="secondary">
                {portfolio.description}
              </AppText>
            ) : null}
          </>
        )}
        <View style={styles.actionRow}>
          {isOwner ? (
            <>
              <Button
                label="Dish"
                size="sm"
                fullWidth={false}
                leftIcon={<Plus color={palette.textOnOrange} size={16} />}
                onPress={() =>
                  navigation.navigate("PortfolioItemPicker", { portfolioId, mode: "dish" })
                }
              />
              <Button
                label="Stall"
                size="sm"
                fullWidth={false}
                variant="secondary"
                onPress={() =>
                  navigation.navigate("PortfolioItemPicker", { portfolioId, mode: "stall" })
                }
              />
              <Button
                label={portfolio.publishedAt ? "Published" : "Publish"}
                size="sm"
                fullWidth={false}
                variant={portfolio.publishedAt ? "secondary" : "primary"}
                disabled={Boolean(portfolio.publishedAt) || isSaving}
                onPress={async () => {
                  setIsSaving(true);
                  try {
                    await publishPortfolio(portfolio.id);
                  } catch (error) {
                    showPortfolioError(error);
                  } finally {
                    setIsSaving(false);
                  }
                }}
              />
              <Button
                label="Edit"
                size="sm"
                fullWidth={false}
                variant="secondary"
                onPress={() => navigation.navigate("PortfolioEdit", { portfolioId })}
              />
              <Button
                label="Collaborators"
                size="sm"
                fullWidth={false}
                variant="secondary"
                onPress={() => navigation.navigate("PortfolioCollaborators", { portfolioId })}
              />
            </>
          ) : (
            <>
              <Button
                label={isFollowing ? "Following" : "Follow"}
                size="sm"
                fullWidth={false}
                variant={isFollowing ? "secondary" : "primary"}
                onPress={() =>
                  isFollowing ? unfollowPortfolio(portfolio.id) : followPortfolio(portfolio.id)
                }
              />
              <Button
                label="Report"
                size="sm"
                fullWidth={false}
                variant="secondary"
                leftIcon={<Flag color={palette.text} size={16} />}
                onPress={() => {
                  Alert.alert("Report portfolio?", "This sends the portfolio to moderation.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Report",
                      style: "destructive",
                      onPress: () => void flagPortfolio(portfolio.id, "inappropriate"),
                    },
                  ]);
                }}
              />
            </>
          )}
        </View>
      </Card>

      <View style={styles.sectionHeader}>
        <AppText variant="h2">Items</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {portfolioItems.length}
        </AppText>
      </View>

      {portfolioItems.length === 0 ? (
        <Card>
          <AppText variant="h3">No items yet</AppText>
          <AppText variant="body" tone="secondary">
            Add dishes or stalls to turn this into a useful food list.
          </AppText>
        </Card>
      ) : (
        portfolioItems.map((item, index) => (
          <PortfolioItemRow
            key={item.id}
            item={item}
            label={formatPortfolioItemLabel(item, labels)}
            index={index}
            totalCount={portfolioItems.length}
            isOwner={isOwner}
            onMoveUp={() => moveItem(item.id, -1)}
            onMoveDown={() => moveItem(item.id, 1)}
            onDelete={() => {
              Alert.alert("Remove item?", "This removes it from this portfolio.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () =>
                    void deleteItem(item.id, portfolioId).catch((error) =>
                      showPortfolioError(error),
                    ),
                },
              ]);
            }}
          />
        ))
      )}

      <Card>
        <View style={styles.itemHeader}>
          <Share2 color={palette.orange} size={20} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold">Share-ready link</AppText>
            <AppText variant="bodySmall" tone="secondary">
              Public portfolio links use the same detail screen until public web routing is wired.
            </AppText>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
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
  itemHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
