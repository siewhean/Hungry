import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Flag, MoreHorizontal, Plus, Share2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { PortfolioItemEditSheet, PortfolioItemRow, ReportListSheet } from "@/components/portfolio";
import { AppText, Button, Card, Dialog, Skeleton } from "@/components/ui";
import { webShareUrl } from "@/constants/links";
import { formatPortfolioSummary, isPortfolioLive } from "@/features/checklistPortfolio/listLabels";
import {
  listErrorMessage,
  listLoadStateForError,
  type ListLoadState,
} from "@/features/checklistPortfolio/listLoadState";
import { useItemDetailsState, type ItemDetail } from "@/features/checklistPortfolio/useItemLabels";
import { runListMutation } from "@/features/checklistPortfolio/runListMutation";
import { shareLink, type ShareChannel } from "@/features/share/messagingShare";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { PortfolioItem } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioDetail">;

const EMPTY_PORTFOLIO_ITEMS: PortfolioItem[] = [];

function formatPortfolioItemLabel(
  item: PortfolioItem,
  details: Record<string, ItemDetail>,
  labelsLoaded: boolean,
  failedIds: ReadonlySet<string>,
) {
  const id = item.dishId ?? item.stallId;
  if (!id) return "List item";
  if (details[id]) return details[id].name;
  // A failed lookup is not a deleted row: say so, and the screen offers a retry.
  if (failedIds.has(id)) return "Couldn't load name";
  // Until the name lookup finishes, say so instead of flashing "Deleted dish".
  if (!labelsLoaded) return "Loading…";
  return item.dishId ? "Deleted dish" : "Deleted stall";
}

function showListError(error: unknown) {
  Alert.alert("List update failed", listErrorMessage(error, "Please refresh and try again."));
}

export function PortfolioDetailScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const portfolioId = route.params.portfolioId;
  const {
    portfolios,
    items,
    collaborators,
    follows,
    refreshPortfolio,
    checkFollowStatus,
    loadPortfolioItems,
    loadPortfolioCollaborators,
    updatePortfolio,
    updateItem,
    publishPortfolio,
    deletePortfolio,
    deleteItem,
    reorderItems,
    followPortfolio,
    unfollowPortfolio,
    leavePortfolio,
    flagPortfolio,
    conflicts,
    clearConflict,
  } = usePortfolioStore(
    useShallow((state) => ({
      portfolios: state.portfolios,
      items: state.items,
      collaborators: state.collaborators,
      follows: state.follows,
      refreshPortfolio: state.refreshPortfolio,
      checkFollowStatus: state.checkFollowStatus,
      loadPortfolioItems: state.loadPortfolioItems,
      loadPortfolioCollaborators: state.loadPortfolioCollaborators,
      updatePortfolio: state.updatePortfolio,
      updateItem: state.updateItem,
      publishPortfolio: state.publishPortfolio,
      deletePortfolio: state.deletePortfolio,
      deleteItem: state.deleteItem,
      reorderItems: state.reorderItems,
      followPortfolio: state.followPortfolio,
      unfollowPortfolio: state.unfollowPortfolio,
      leavePortfolio: state.leavePortfolio,
      flagPortfolio: state.flagPortfolio,
      conflicts: state.conflicts,
      clearConflict: state.clearConflict,
    })),
  );
  const portfolio = portfolios.find((entry) => entry.id === portfolioId);
  const conflict = conflicts[portfolioId];
  // Stable fallback: a new [] each render re-ran effects keyed on the items (render loop).
  const portfolioItems = items[portfolioId] ?? EMPTY_PORTFOLIO_ITEMS;
  const isOwner = portfolio?.ownerId === profile.id;
  // Editors may add, reorder and remove items (the item RPCs allow them); publish,
  // edit details, collaborators and delete stay owner-only.
  const myRole = collaborators[portfolioId]?.find(
    (collaborator) => collaborator.userId === profile.id,
  )?.role;
  const canEdit = isOwner || myRole === "editor";
  const rootNavigation = getRootNavigation(navigation as any);
  const isFollowing = follows[portfolioId] === true;
  const [isSaving, setIsSaving] = useState(false);
  // Cross-platform confirm (Alert.alert is a no-op on web, so E2E can't drive it).
  const [visibilityDialog, setVisibilityDialog] = useState<"publish" | "unpublish" | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  // Loading, failed and missing are different screens: only a confirmed miss says "not found".
  const [listState, setListState] = useState<ListLoadState>(portfolio ? "ready" : "loading");
  const [itemsState, setItemsState] = useState<ListLoadState>(
    items[portfolioId] ? "ready" : "loading",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const insets = useSafeAreaInsets();
  const topSpacing = Math.max(insets.top, spacing[4]);

  useEffect(() => {
    let mounted = true;
    // Load just this list (not every list) and the viewer's follow state for it.
    void refreshPortfolio(portfolioId)
      .then(() => mounted && setListState("ready"))
      .catch((error) => {
        console.error("Failed to load list:", error);
        if (mounted) setListState(listLoadStateForError(error));
      });
    void loadPortfolioItems(portfolioId)
      .then(() => mounted && setItemsState("ready"))
      .catch((error) => {
        console.error("Failed to load list items:", error);
        if (mounted) setItemsState("error");
      });
    void checkFollowStatus(portfolioId).catch((error) =>
      console.error("Failed to load follow status:", error),
    );
    // Your own collaborator row says whether you can edit (only members get rows).
    void loadPortfolioCollaborators(portfolioId).catch((error) =>
      console.error("Failed to load collaborators:", error),
    );
    return () => {
      mounted = false;
    };
  }, [
    checkFollowStatus,
    loadPortfolioCollaborators,
    loadPortfolioItems,
    portfolioId,
    refreshPortfolio,
    reloadKey,
  ]);

  const {
    details,
    isLoaded: labelsLoaded,
    failedIds,
    retry: retryLabels,
  } = useItemDetailsState(portfolioItems, portfolioId);

  const statsLabel = useMemo(
    () => (portfolio ? formatPortfolioSummary(portfolio, portfolioItems.length) : ""),
    [portfolio, portfolioItems],
  );
  const isLive = portfolio ? isPortfolioLive(portfolio) : false;

  const runOwnerAction = useCallback(async (action: () => Promise<void>) => {
    setIsSaving(true);
    try {
      await action();
    } catch (error) {
      showListError(error);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const moveItem = useCallback(
    async (itemId: string, direction: -1 | 1) => {
      const currentIndex = portfolioItems.findIndex((item) => item.id === itemId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= portfolioItems.length) return;
      const nextIds = portfolioItems.map((item) => item.id);
      const [movedItem] = nextIds.splice(currentIndex, 1);
      nextIds.splice(nextIndex, 0, movedItem);
      try {
        // The store moves the row right away, queues the write, and puts it back on failure.
        await reorderItems(portfolioId, nextIds);
      } catch (error) {
        showListError(error);
      }
    },
    [portfolioId, portfolioItems, reorderItems],
  );

  const retry = () => {
    setListState("loading");
    setItemsState("loading");
    setReloadKey((key) => key + 1);
  };

  if (!portfolio) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: palette.bg, padding: spacing[5], paddingTop: topSpacing },
        ]}
      >
        {listState === "loading" ? (
          <View style={{ alignSelf: "stretch", gap: spacing[3] }}>
            <Skeleton height={28} width="60%" />
            <Skeleton height={16} width="40%" />
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : (
          <>
            <AppText variant="h2">
              {listState === "error" ? "Couldn't load this list" : "List not found"}
            </AppText>
            <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>
              {listState === "error"
                ? "Check your connection and try again."
                : "It may be private now or no longer on Hungry."}
            </AppText>
            {listState === "error" ? (
              <Button label="Retry" onPress={retry} style={{ marginTop: spacing[4] }} />
            ) : null}
            <Button
              label="Go back"
              variant={listState === "error" ? "secondary" : "primary"}
              onPress={() => navigation.goBack()}
              style={{ marginTop: spacing[3] }}
            />
          </>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: topSpacing }}
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
          <AppText variant="h1" numberOfLines={2}>
            {portfolio.name}
          </AppText>
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
        {portfolio.description ? (
          <AppText variant="body" tone="secondary">
            {portfolio.description}
          </AppText>
        ) : null}
        <View style={styles.actionRow}>
          {canEdit ? (
            <Button
              label="Add"
              size="sm"
              fullWidth={false}
              leftIcon={<Plus color={palette.textOnOrange} size={16} />}
              onPress={() => setAddOpen(true)}
            />
          ) : null}
          {isOwner ? (
            <>
              <Button
                label={isLive ? "Unpublish" : "Publish"}
                size="sm"
                fullWidth={false}
                variant="secondary"
                disabled={isSaving}
                onPress={() => setVisibilityDialog(isLive ? "unpublish" : "publish")}
              />
              <Button
                label="More"
                size="sm"
                fullWidth={false}
                variant="secondary"
                accessibilityLabel="More list options"
                leftIcon={<MoreHorizontal color={palette.text} size={16} />}
                onPress={() => setMenuOpen(true)}
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
                  void runListMutation(
                    () =>
                      isFollowing ? unfollowPortfolio(portfolio.id) : followPortfolio(portfolio.id),
                    {
                      success: isFollowing ? "Unfollowed list" : "Following list",
                      failure: isFollowing ? "Couldn't unfollow." : "Couldn't follow.",
                    },
                  )
                }
              />
              {myRole ? (
                <Button
                  label="Leave list"
                  size="sm"
                  fullWidth={false}
                  variant="secondary"
                  disabled={isSaving}
                  onPress={() => {
                    Alert.alert(
                      "Leave this list?",
                      "You'll stop seeing it under Shared with me. The owner can add you again.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Leave",
                          style: "destructive",
                          onPress: () =>
                            void runOwnerAction(async () => {
                              await leavePortfolio(portfolio.id, profile.id);
                              navigation.goBack();
                            }),
                        },
                      ],
                    );
                  }}
                />
              ) : null}
              {/* Only public lists can be reported (portfolio_flags insert policy). */}
              {portfolio.visibility === "public" ? (
                <Button
                  label="Report"
                  size="sm"
                  fullWidth={false}
                  variant="secondary"
                  leftIcon={<Flag color={palette.text} size={16} />}
                  onPress={() => setReportOpen(true)}
                />
              ) : null}
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

      {portfolioItems.length === 0 && itemsState === "loading" ? (
        <View style={{ gap: spacing[3] }}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : portfolioItems.length === 0 && itemsState === "error" ? (
        <Card>
          <AppText variant="h3">{"Couldn't load the items"}</AppText>
          <AppText variant="body" tone="secondary">
            Check your connection and try again.
          </AppText>
          <Button label="Retry" variant="secondary" onPress={retry} />
        </Card>
      ) : portfolioItems.length === 0 ? (
        <Card>
          <AppText variant="h3">No items yet</AppText>
          <AppText variant="body" tone="secondary">
            Add dishes or stalls to turn this into a useful food list.
          </AppText>
        </Card>
      ) : (
        <>
          {failedIds.size > 0 ? (
            <Card>
              <AppText variant="bodySmall" tone="secondary">
                {"Couldn't load some dish and stall names."}
              </AppText>
              <Button
                label="Retry"
                size="sm"
                fullWidth={false}
                variant="secondary"
                onPress={retryLabels}
              />
            </Card>
          ) : null}
          {portfolioItems.map((item, index) => (
            <PortfolioItemRow
              key={item.id}
              item={item}
              label={formatPortfolioItemLabel(item, details, labelsLoaded, failedIds)}
              detail={details[item.dishId ?? item.stallId ?? ""]}
              index={index}
              totalCount={portfolioItems.length}
              showRank={portfolio.type === "ranking"}
              canEdit={canEdit}
              onOpen={() => {
                if (item.dishId) rootNavigation.navigate("DishDetail", { dishId: item.dishId });
                else if (item.stallId)
                  rootNavigation.navigate("StallDetail", { venueId: item.stallId });
              }}
              onMoveUp={() => moveItem(item.id, -1)}
              onMoveDown={() => moveItem(item.id, 1)}
              onEdit={() => setEditingItem(item)}
              onDelete={() => {
                Alert.alert("Remove item?", "This removes it from this list.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () =>
                      void deleteItem(item.id, portfolioId).catch((error) => showListError(error)),
                  },
                ]);
              }}
            />
          ))}
        </>
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

      <Dialog
        visible={visibilityDialog === "publish"}
        title="Publish this list?"
        message="It becomes public: anyone with the link can see it."
        buttons={[
          {
            text: "Publish",
            onPress: () => void runOwnerAction(() => publishPortfolio(portfolio.id)),
          },
          { text: "Cancel", style: "cancel" },
        ]}
        onClose={() => setVisibilityDialog(null)}
      />
      <Dialog
        visible={visibilityDialog === "unpublish"}
        title="Unpublish this list?"
        message="It goes back to private."
        buttons={[
          {
            text: "Unpublish",
            onPress: () =>
              void runOwnerAction(() => updatePortfolio(portfolio.id, { visibility: "private" })),
          },
          { text: "Cancel", style: "cancel" },
        ]}
        onClose={() => setVisibilityDialog(null)}
      />

      <Dialog
        visible={addOpen}
        title="Add to this list"
        buttons={[
          {
            text: "A dish",
            onPress: () =>
              navigation.navigate("PortfolioItemPicker", { portfolioId, mode: "dish" }),
          },
          {
            text: "A stall",
            onPress: () =>
              navigation.navigate("PortfolioItemPicker", { portfolioId, mode: "stall" }),
          },
          { text: "Cancel", style: "cancel" },
        ]}
        onClose={() => setAddOpen(false)}
      />

      <Dialog
        visible={menuOpen}
        title="List options"
        buttons={[
          {
            text: "Edit title and details",
            onPress: () => navigation.navigate("PortfolioEdit", { portfolioId }),
          },
          {
            text: "Collaborators",
            onPress: () => navigation.navigate("PortfolioCollaborators", { portfolioId }),
          },
          {
            text: "Delete list",
            style: "destructive",
            // The menu is a modal that is still closing: let it finish before the alert opens.
            onPress: () =>
              setTimeout(() => {
                Alert.alert("Delete this list?", "This can't be undone.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () =>
                      void runOwnerAction(async () => {
                        await deletePortfolio(portfolio.id);
                        navigation.goBack();
                      }),
                  },
                ]);
              }, 300),
          },
          { text: "Cancel", style: "cancel" },
        ]}
        onClose={() => setMenuOpen(false)}
      />

      <ReportListSheet
        visible={reportOpen}
        isSending={isReporting}
        onClose={() => setReportOpen(false)}
        onSubmit={(reason, reportDetails) => {
          setIsReporting(true);
          void runListMutation(() => flagPortfolio(portfolio.id, reason, reportDetails), {
            success: "Thanks. We'll review this list.",
            failure: "Couldn't send the report.",
          })
            .then((sent) => {
              if (sent) setReportOpen(false);
            })
            .finally(() => setIsReporting(false));
        }}
      />

      <PortfolioItemEditSheet
        visible={editingItem !== null}
        title={
          editingItem ? formatPortfolioItemLabel(editingItem, details, labelsLoaded, failedIds) : ""
        }
        confirmLabel="Save"
        initialScore={editingItem?.score}
        initialPublicNotes={editingItem?.publicNotes}
        initialPrivateNotes={editingItem?.privateNotes}
        isSaving={isSaving}
        onClose={() => setEditingItem(null)}
        onSubmit={(next) => {
          const target = editingItem;
          if (!target) return;
          void runOwnerAction(async () => {
            // The server keeps the old value for anything left out; "" clears a note.
            await updateItem(target.id, {
              score: next.score,
              publicNotes: next.publicNotes.trim(),
              privateNotes: next.privateNotes.trim(),
            });
            setEditingItem(null);
          });
        }}
      />
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
