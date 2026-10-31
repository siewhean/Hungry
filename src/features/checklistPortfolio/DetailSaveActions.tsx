import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Plus } from "lucide-react-native";
import { Pressable, View } from "react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppSymbol, AppText, BottomSheet, Button, Input } from "@/components/ui";
import {
  buildSaveToListOptions,
  DEFAULT_PORTFOLIO_NAME,
  type SaveToListOption,
} from "@/features/checklistPortfolio/saveToListOptions";
import { PORTFOLIO_NAME_MAX_LENGTH } from "@/features/checklistPortfolio/listLabels";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useMissionStore } from "@/store/useMissionStore";
import { getPortfolioOwnerId, usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

export type DetailSaveTarget =
  | {
      itemType: "dish";
      id: string;
      label: string;
      venueId?: string;
    }
  | {
      itemType: "stall";
      id: string;
      label: string;
      venueId: string;
    };

interface UseDetailSaveActionsOptions {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  target: DetailSaveTarget;
  /** The page the save comes from, sent with portfolio_item_added (e.g. "catalog_detail"). */
  surface?: string;
}

function isDuplicateError(error: unknown): boolean {
  return error instanceof Error && /already|duplicate/i.test(error.message);
}

function findPortfolioTargetItem(
  items: ReturnType<typeof usePortfolioStore.getState>["items"],
  portfolioId: string,
  target: DetailSaveTarget,
) {
  return (items[portfolioId] ?? []).find((item) => {
    if (target.itemType === "dish") {
      return item.itemType === "dish" && item.dishId === target.id;
    }
    return item.itemType === "stall" && item.stallId === target.id;
  });
}

export function useDetailSaveActions({ navigation, target, surface }: UseDetailSaveActionsOptions) {
  const profile = useProfileStore((state) => state.profile);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);
  const [isAddingToPortfolio, setIsAddingToPortfolio] = useState(false);
  const listSheetRef = useRef<BottomSheetModal>(null);
  // Bumped on every open so the sheet reloads your lists and their items.
  const [listSheetOpenCount, setListSheetOpenCount] = useState(0);

  const requireAuth = useCallback(() => {
    if (isAuthenticated) {
      return true;
    }

    setReturnRoute(
      target.itemType === "dish"
        ? { name: "DishDetail", params: { dishId: target.id } }
        : { name: "StallDetail", params: { venueId: target.venueId } },
    );
    showToast({ message: "Sign in to save this to your Hungry lists.", tone: "warning" });
    navigation.navigate("AuthStack", { screen: "Login" });
    return false;
  }, [isAuthenticated, navigation, setReturnRoute, showToast, target]);

  /** Opens "Save to list": your lists plus lists shared with you as an editor. */
  const addToPortfolio = useCallback(async () => {
    if (!requireAuth()) {
      return;
    }
    setListSheetOpenCount((count) => count + 1);
    listSheetRef.current?.present();
  }, [requireAuth]);

  const togglePortfolio = useCallback(
    async (option: SaveToListOption, newListName?: string) => {
      if (isAddingToPortfolio) {
        return;
      }
      setIsAddingToPortfolio(true);
      try {
        const portfolioState = usePortfolioStore.getState();
        let portfolio = option.portfolio;
        if (!portfolio) {
          // Hungry Picks stays private: a quick save must never land in a public ranking.
          portfolio = await portfolioState.createPortfolio({
            name: newListName?.trim() || DEFAULT_PORTFOLIO_NAME,
            description: newListName ? undefined : "Quick saves from dish and stall detail pages.",
            type: "recommendation",
            visibility: "private",
          });
        }

        if (!usePortfolioStore.getState().items[portfolio.id]) {
          await usePortfolioStore.getState().loadPortfolioItems(portfolio.id);
        }

        const existing = findPortfolioTargetItem(
          usePortfolioStore.getState().items,
          portfolio.id,
          target,
        );
        if (existing) {
          await usePortfolioStore.getState().deleteItem(existing.id, portfolio.id);
          showToast({ message: `Removed from ${portfolio.name}.`, tone: "info" });
          return;
        }

        await usePortfolioStore
          .getState()
          .addItem(
            target.itemType === "dish"
              ? { portfolioId: portfolio.id, itemType: "dish", dishId: target.id }
              : { portfolioId: portfolio.id, itemType: "stall", stallId: target.id },
            { surface },
          );
        showToast({ message: `Added to ${portfolio.name}.`, tone: "success" });
        if (target.itemType === "stall") {
          // Mission progress is best-effort: the save already succeeded.
          void useMissionStore
            .getState()
            .incrementProgress(profile.id, "add_to_collection")
            .catch(() => undefined);
        }
      } catch (error) {
        if (!isDuplicateError(error)) {
          reportError(error, { feature: "DetailSaveActions", action: "togglePortfolio" });
        }
        showToast({
          message: isDuplicateError(error)
            ? `${target.label} is already saved to that list.`
            : "Could not update your list.",
          tone: isDuplicateError(error) ? "info" : "error",
        });
      } finally {
        setIsAddingToPortfolio(false);
      }
    },
    [isAddingToPortfolio, profile.id, showToast, surface, target],
  );

  const saveToListSheet = (
    <SaveToListSheet
      sheetRef={listSheetRef}
      openCount={listSheetOpenCount}
      target={target}
      isSaving={isAddingToPortfolio}
      onToggle={togglePortfolio}
    />
  );

  /** Your own lists for the Save hold menu; loaded when the menu opens. */
  const ownPortfolios = usePortfolioStore((state) => state.portfolios);
  const ownPortfolioIds = usePortfolioStore((state) => state.scopeIds.mine);
  const portfolioItems = usePortfolioStore((state) => state.items);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsFailed, setCollectionsFailed] = useState(false);
  const loadCollections = useCallback(async () => {
    if (!isAuthenticated) return;
    setCollectionsLoading(true);
    setCollectionsFailed(false);
    try {
      const store = usePortfolioStore.getState();
      await store.loadPortfolioScope("mine");
      // Every open reads the items again, so a change on another device shows the right ticks.
      await store.loadItemsForPortfolios(usePortfolioStore.getState().scopeIds.mine ?? []);
    } catch (error) {
      // No list options (and no "Hungry Picks" placeholder) until a load succeeds; "New
      // collection" opens the sheet, which retries.
      reportError(error, { feature: "DetailSaveActions", action: "loadCollections" });
      setCollectionsFailed(true);
    } finally {
      setCollectionsLoading(false);
    }
  }, [isAuthenticated]);
  const collectionOptions = collectionsFailed
    ? []
    : buildSaveToListOptions(ownPortfolios, ownPortfolioIds ?? [], [], getPortfolioOwnerId()).map(
        (option) => ({
          option,
          selected: Boolean(
            option.portfolio &&
            findPortfolioTargetItem(portfolioItems, option.portfolio.id, target),
          ),
        }),
      );

  return {
    addToPortfolio,
    collectionOptions,
    collectionsLoading,
    loadCollections,
    togglePortfolio,
    isAddingToPortfolio,
    /** Render once on the page; addToPortfolio opens it. */
    saveToListSheet,
  };
}

interface SaveToListSheetProps {
  sheetRef: RefObject<BottomSheetModal | null>;
  openCount: number;
  target: DetailSaveTarget;
  isSaving: boolean;
  onToggle: (option: SaveToListOption, newListName?: string) => Promise<void>;
}

function SaveToListSheet({
  sheetRef,
  openCount,
  target,
  isSaving,
  onToggle,
}: SaveToListSheetProps) {
  const { palette, spacing } = useHungryTheme();
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const items = usePortfolioStore((state) => state.items);
  const ownIds = usePortfolioStore((state) => state.scopeIds.mine);
  const [editorIds, setEditorIds] = useState<string[]>([]);
  // The open that last finished loading; anything newer is still loading.
  const [retryCount, setRetryCount] = useState(0);
  const loadKey = openCount + retryCount;
  const [loadedKey, setLoadedKey] = useState(0);
  const isLoading = loadedKey < loadKey;
  const [loadFailed, setLoadFailed] = useState(false);
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    if (loadKey === 0) return;
    let mounted = true;
    void (async () => {
      try {
        const store = usePortfolioStore.getState();
        const [, nextEditorIds] = await Promise.all([
          store.loadPortfolioScope("mine"),
          getHungryService().portfolio.getSharedPortfolioIds({ role: "editor" }),
        ]);
        if (nextEditorIds.length > 0) await store.loadPortfolioScope("shared");
        const listIds = [...(usePortfolioStore.getState().scopeIds.mine ?? []), ...nextEditorIds];
        // Items decide each checkmark, so every open reads them again in one call.
        await store.loadItemsForPortfolios(listIds);
        if (mounted) {
          setEditorIds(nextEditorIds);
          setLoadFailed(false);
        }
      } catch (error) {
        reportError(error, { feature: "SaveToListSheet", action: "loadLists" });
        if (mounted) setLoadFailed(true);
      } finally {
        if (mounted) setLoadedKey(loadKey);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadKey]);

  // Until your lists load, offering "Hungry Picks" would create a second one on tap.
  const options =
    isLoading || loadFailed
      ? []
      : buildSaveToListOptions(portfolios, ownIds ?? [], editorIds, getPortfolioOwnerId());

  return (
    <BottomSheet ref={sheetRef} accessibilityLabel="Save to list" snapPoints={["60%", "90%"]}>
      <View style={{ gap: spacing[2] }}>
        <AppText variant="h2">Save to list</AppText>
        <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
          {target.label}
        </AppText>
        {isLoading ? (
          <AppText variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
            Loading your lists…
          </AppText>
        ) : loadFailed ? (
          <View style={{ gap: spacing[2] }}>
            <AppText variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
              {"Couldn't load your lists. Check your connection and try again."}
            </AppText>
            <Button
              label="Retry"
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => setRetryCount((count) => count + 1)}
            />
          </View>
        ) : null}
        {options.map((option) => {
          const selected = Boolean(
            option.portfolio && findPortfolioTargetItem(items, option.portfolio.id, target),
          );
          return (
            <Pressable
              key={option.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: isSaving || isLoading }}
              accessibilityLabel={option.isShared ? `${option.name}, shared with you` : option.name}
              disabled={isSaving || isLoading}
              onPress={() => void onToggle(option)}
              style={{
                alignItems: "center",
                borderBottomColor: palette.border,
                borderBottomWidth: 1,
                flexDirection: "row",
                gap: spacing[3],
                minHeight: 54,
              }}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="body" numberOfLines={1}>
                  {option.name}
                </AppText>
                {option.isShared ? (
                  <AppText variant="bodySmall" tone="secondary">
                    Shared with you
                  </AppText>
                ) : null}
              </View>
              {/* An empty circle when not in the list, a filled tick when it is. */}
              <AppSymbol
                name={selected ? "triedFilled" : "emptyCheckbox"}
                color={selected ? palette.orange : palette.textMuted}
                size={22}
              />
            </Pressable>
          );
        })}
        <Input
          label="New list"
          placeholder="Name a new private list"
          maxLength={PORTFOLIO_NAME_MAX_LENGTH}
          value={newListName}
          onChangeText={setNewListName}
        />
        <Button
          label="Create and add"
          variant="secondary"
          leftIcon={<Plus color={palette.text} size={16} />}
          disabled={!newListName.trim() || isSaving || isLoading}
          onPress={() => {
            const name = newListName.trim();
            void onToggle({ key: "new", name, isShared: false }, name).then(() =>
              setNewListName(""),
            );
          }}
        />
      </View>
    </BottomSheet>
  );
}
