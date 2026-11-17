import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Flag, Plus, Share2 } from "lucide-react-native";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { PortfolioItemRow } from "@/components/portfolio";
import { AppText, Button, Card, Input } from "@/components/ui";
import { webShareUrl } from "@/constants/links";
import { shareLink, type ShareChannel } from "@/features/share/messagingShare";
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
  const insets = useSafeAreaInsets();
  const { palette, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const portfolioId = route.params.portfolioId;
  const {
    portfolios,
    collaborators,
    loadPortfolioCollaborators,
    checkFollowStatus,
    items,
    follows,
    followerCounts,
    loadPortfolios,
    loadPortfolioItems,
    updatePortfolio,
    deleteItem,
    updateItem,
    deletePortfolio,
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
  const collaborator = (collaborators[portfolioId] ?? []).find(
    (person) => person.userId === profile.id,
  );
  const canEdit = isOwner || collaborator?.role === "editor";
  const isFollowing = follows[portfolioId] === true;
  const [draftName, setDraftName] = useState(portfolio?.name ?? "");
  const [draftDescription, setDraftDescription] = useState(portfolio?.description ?? "");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [itemScore, setItemScore] = useState("");
  const [itemPublicNotes, setItemPublicNotes] = useState("");
  const [itemPrivateNotes, setItemPrivateNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const initializedPortfolio = useRef<string | undefined>(portfolio?.id);
  useEffect(() => {
    let active = true;
    setLoadState("loading");
    void Promise.all([
      loadPortfolios(),
      loadPortfolioItems(portfolioId),
      loadPortfolioCollaborators(portfolioId),
      checkFollowStatus(portfolioId),
    ])
      .then(() => {
        if (active) setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadState("failed");
          setLoadError(error instanceof Error ? error.message : "Please retry.");
        }
      });
    return () => {
      active = false;
    };
  }, [
    loadPortfolioItems,
    loadPortfolios,
    loadPortfolioCollaborators,
    checkFollowStatus,
    portfolioId,
    retry,
  ]);

  useEffect(() => {
    if (!portfolio || initializedPortfolio.current === portfolio.id) return;
    initializedPortfolio.current = portfolio.id;
    setDraftName(portfolio.name);
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

    void hydrateLabels().catch((error: unknown) => {
      if (mounted)
        Alert.alert(
          "Could not load item details",
          error instanceof Error ? error.message : "Please retry.",
        );
    });
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
        description: nextDescription || null,
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
        <AppText variant="h2">
          {loadState === "loading"
            ? "Loading portfolio…"
            : loadState === "failed"
              ? "Could not load portfolio"
              : "Portfolio not found"}
        </AppText>
        {loadState === "failed" ? (
          <>
            <AppText>{loadError}</AppText>
            <Button label="Retry" onPress={() => setRetry((value) => value + 1)} />
          </>
        ) : null}
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
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top }}
      contentContainerStyle={[styles.content, { gap: spacing[4], padding: spacing[4] }]}
    >
      {loadState === "failed" ? (
        <Card>
          <AppText>{loadError}</AppText>
          <Button label="Retry loading" onPress={() => setRetry((value) => value + 1)} />
        </Card>
      ) : null}
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
          {canEdit ? (
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
                label="Edit"
                disabled={!isOwner}
                size="sm"
                fullWidth={false}
                variant="secondary"
                onPress={() => navigation.navigate("PortfolioEdit", { portfolioId })}
              />
              <Button
                label="Collaborators"
                disabled={!isOwner}
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

      {editingItem && canEdit ? (
        <Card>
          <Input
            label="Score (1–10, one decimal)"
            value={itemScore}
            onChangeText={setItemScore}
            keyboardType="decimal-pad"
          />
          <Input
            label="Public notes"
            value={itemPublicNotes}
            onChangeText={setItemPublicNotes}
            multiline
          />
          <Input
            label="Private notes"
            value={itemPrivateNotes}
            onChangeText={setItemPrivateNotes}
            multiline
          />
          <Button
            label="Save item"
            loading={isSaving}
            disabled={isSaving}
            onPress={() => {
              if (itemScore.trim() && !/^(?:[1-9](?:\.\d)?|10(?:\.0)?)$/.test(itemScore.trim())) {
                Alert.alert("Invalid score", "Use 1–10 with at most one decimal.");
                return;
              }
              setIsSaving(true);
              void updateItem(editingItem.id, {
                score: itemScore.trim() ? Number(itemScore) : null,
                publicNotes: itemPublicNotes.trim() || null,
                privateNotes: itemPrivateNotes.trim() || null,
              })
                .then(() => setEditingItem(null))
                .catch(showPortfolioError)
                .finally(() => setIsSaving(false));
            }}
          />
          <Button
            label="Cancel item edit"
            variant="secondary"
            onPress={() => setEditingItem(null)}
          />
        </Card>
      ) : null}
      {isOwner ? (
        <Button
          label="Delete portfolio"
          variant="secondary"
          onPress={() =>
            Alert.alert(
              "Delete portfolio?",
              "This permanently removes this portfolio and its items.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    void deletePortfolio(portfolioId)
                      .then(() => navigation.goBack())
                      .catch(showPortfolioError);
                  },
                },
              ],
            )
          }
        />
      ) : null}

      {followerCounts[portfolioId] !== undefined ? (
        <AppText variant="bodySmall" tone="secondary">
          {followerCounts[portfolioId]} followers
        </AppText>
      ) : null}
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
            isOwner={canEdit}
            canReadPrivateNotes={isOwner || Boolean(collaborator)}
            onEdit={() => {
              setEditingItem(item);
              setItemScore(item.score?.toString() ?? "");
              setItemPublicNotes(item.publicNotes ?? "");
              setItemPrivateNotes(item.privateNotes ?? "");
            }}
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
            <AppText variant="bodyBold">Share this list</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {portfolio.visibility === "public"
                ? "Anyone with the link can see it, no sign-in needed."
                : "Make this list public to share a link with friends."}
            </AppText>
          </View>
        </View>
        {portfolio.visibility === "public" ? (
          <View style={[styles.actionRow, { marginTop: 12 }]}>
            {SHARE_CHANNELS.map(({ channel, label }) => (
              <Button
                key={channel}
                label={label}
                variant="secondary"
                onPress={() =>
                  void shareLink(
                    {
                      kind: "portfolio",
                      id: portfolio.id,
                      message: `${portfolio.name} on Hungry`,
                      url: webShareUrl("portfolio", portfolio.id),
                    },
                    channel,
                  )
                }
              />
            ))}
          </View>
        ) : null}
      </Card>
    </ScrollView>
  );
}

const SHARE_CHANNELS: { channel: ShareChannel; label: string }[] = [
  { channel: "whatsapp", label: "WhatsApp" },
  { channel: "telegram", label: "Telegram" },
  { channel: "system_share", label: "More" },
];

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
