import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Check, ListPlus, Plus } from "lucide-react-native";
import { Pressable, View } from "react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, BottomSheet, Button, Card, Input } from "@/components/ui";
import {
  buildSaveToListOptions,
  DEFAULT_PORTFOLIO_NAME,
  type SaveToListOption,
} from "@/features/checklistPortfolio/saveToListOptions";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useChecklistStore } from "@/store/useChecklistStore";
import { useMissionStore } from "@/store/useMissionStore";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

const DEFAULT_CHECKLIST_NAME = "Want to Try";

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
}

function isDuplicateError(error: unknown): boolean {
  return error instanceof Error && /already|duplicate/i.test(error.message);
}

function checklistContainsTarget(
  items: ReturnType<typeof useChecklistStore.getState>["items"],
  checklistId: string,
  target: DetailSaveTarget,
) {
  return (items[checklistId] ?? []).some((item) => {
    if (target.itemType === "dish") {
      return item.itemType === "dish" && item.dishId === target.id;
    }
    return item.itemType === "stall" && item.stallId === target.id;
  });
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

export function useDetailSaveActions({ navigation, target }: UseDetailSaveActionsOptions) {
  const profile = useProfileStore((state) => state.profile);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);
  const [isAddingToChecklist, setIsAddingToChecklist] = useState(false);
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

  const addToChecklist = useCallback(async () => {
    if (isAddingToChecklist || !requireAuth()) {
      return;
    }

    setIsAddingToChecklist(true);
    try {
      let checklistState = useChecklistStore.getState();
      if (!checklistState.isLoaded) {
        await checklistState.loadChecklists();
        checklistState = useChecklistStore.getState();
      }

      // Quick save only ever uses its own "Want to Try" list, never another checklist.
      let checklist = checklistState.checklists.find(
        (entry) => entry.name === DEFAULT_CHECKLIST_NAME,
      );
      if (!checklist) {
        checklist = await checklistState.createChecklist(DEFAULT_CHECKLIST_NAME);
      }

      if (!useChecklistStore.getState().items[checklist.id]) {
        await useChecklistStore.getState().loadChecklistItems(checklist.id);
      }

      if (checklistContainsTarget(useChecklistStore.getState().items, checklist.id, target)) {
        showToast({
          message: `${target.label} is already in ${checklist.name}.`,
          tone: "info",
        });
        return;
      }

      await useChecklistStore
        .getState()
        .addItem(
          target.itemType === "dish"
            ? { checklistId: checklist.id, itemType: "dish", dishId: target.id }
            : { checklistId: checklist.id, itemType: "stall", stallId: target.id },
        );
      showToast({ message: `Added to ${checklist.name}.`, tone: "success" });
    } catch (error) {
      showToast({
        message: isDuplicateError(error)
          ? `${target.label} is already saved to that checklist.`
          : "Could not add this to your checklist.",
        tone: isDuplicateError(error) ? "info" : "error",
      });
    } finally {
      setIsAddingToChecklist(false);
    }
  }, [isAddingToChecklist, profile.id, requireAuth, showToast, target]);

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
    [isAddingToPortfolio, profile.id, showToast, target],
  );

  const saveToListSheet = (
    <SaveToListSheet
      sheetRef={listSheetRef}
      openCount={listSheetOpenCount}
      profileId={profile.id}
      target={target}
      isSaving={isAddingToPortfolio}
      onToggle={togglePortfolio}
    />
  );

  return {
    addToChecklist,
    addToPortfolio,
    isAddingToChecklist,
    isAddingToPortfolio,
    /** Render once on the page; addToPortfolio opens it. */
    saveToListSheet,
  };
}

interface SaveToListSheetProps {
  sheetRef: RefObject<BottomSheetModal | null>;
  openCount: number;
  profileId: string;
  target: DetailSaveTarget;
  isSaving: boolean;
  onToggle: (option: SaveToListOption, newListName?: string) => Promise<void>;
}

function SaveToListSheet({
  sheetRef,
  openCount,
  profileId,
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
  const [loadedOpenCount, setLoadedOpenCount] = useState(0);
  const isLoading = loadedOpenCount < openCount;
  const [loadFailed, setLoadFailed] = useState(false);
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    if (openCount === 0) return;
    let mounted = true;
    void (async () => {
      try {
        const store = usePortfolioStore.getState();
        const [, nextEditorIds] = await Promise.all([
          store.loadPortfolioScope("mine"),
          getHungryService().portfolio.getSharedPortfolioIds({ role: "editor" }),
        ]);
        if (nextEditorIds.length > 0) await store.loadPortfolioScope("shared");
        const state = usePortfolioStore.getState();
        const listIds = [...(state.scopeIds.mine ?? []), ...nextEditorIds];
        // Item lists decide each checkmark; a failed one just shows unchecked.
        await Promise.all(
          listIds
            .filter((id) => !state.items[id])
            .map((id) => state.loadPortfolioItems(id).catch(() => undefined)),
        );
        if (mounted) {
          setEditorIds(nextEditorIds);
          setLoadFailed(false);
        }
      } catch (error) {
        console.error("Failed to load lists:", error);
        if (mounted) setLoadFailed(true);
      } finally {
        if (mounted) setLoadedOpenCount(openCount);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [openCount]);

  const options = buildSaveToListOptions(portfolios, ownIds ?? [], editorIds, profileId);

  return (
    <BottomSheet ref={sheetRef} accessibilityLabel="Save to list" snapPoints={["60%", "90%"]}>
      <View style={{ gap: spacing[2] }}>
        <AppText variant="h2">Save to list</AppText>
        <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
          {target.label}
        </AppText>
        {loadFailed ? (
          <AppText variant="bodySmall" tone="secondary">
            {"Couldn't load all your lists. Check your connection and try again."}
          </AppText>
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
              {selected ? <Check size={18} color={palette.orange} /> : null}
            </Pressable>
          );
        })}
        <Input
          label="New list"
          placeholder="Name a new private list"
          value={newListName}
          onChangeText={setNewListName}
        />
        <Button
          label="Create and add"
          variant="secondary"
          leftIcon={<Plus color={palette.text} size={16} />}
          disabled={!newListName.trim() || isSaving}
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

interface DetailSaveActionsCardProps {
  title: string;
  body: string;
  onAddToChecklist: () => void;
  /** Omit to hide the portfolio action (stalls save to Lists from the interaction bar). */
  onAddToPortfolio?: () => void;
  isAddingToChecklist?: boolean;
  isAddingToPortfolio?: boolean;
}

export function DetailSaveActionsCard({
  title,
  body,
  onAddToChecklist,
  onAddToPortfolio,
  isAddingToChecklist = false,
  isAddingToPortfolio = false,
}: DetailSaveActionsCardProps) {
  const { palette, spacing } = useHungryTheme();

  return (
    <Card style={{ gap: spacing[3] }}>
      <View style={{ gap: spacing[1] }}>
        <AppText variant="h3">{title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {body}
        </AppText>
      </View>
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        <Button
          label="Add to Checklist"
          variant="secondary"
          size="sm"
          fullWidth={false}
          loading={isAddingToChecklist}
          onPress={onAddToChecklist}
          leftIcon={<ListPlus color={palette.text} size={14} />}
          style={{ flex: 1, minWidth: 0 }}
          labelNumberOfLines={1}
          labelEllipsizeMode="tail"
        />
        {onAddToPortfolio ? (
          <Button
            label="Add to list"
            variant="secondary"
            size="sm"
            fullWidth={false}
            loading={isAddingToPortfolio}
            onPress={onAddToPortfolio}
            leftIcon={<Plus color={palette.text} size={14} />}
            style={{ flex: 1, minWidth: 0 }}
            labelNumberOfLines={1}
            labelEllipsizeMode="tail"
          />
        ) : null}
      </View>
    </Card>
  );
}
