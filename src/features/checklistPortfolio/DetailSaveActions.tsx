import { useCallback, useState } from "react";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ListPlus, Plus } from "lucide-react-native";
import { View } from "react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Card } from "@/components/ui";
import { useChecklistStore } from "@/store/useChecklistStore";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

const DEFAULT_CHECKLIST_NAME = "Want to Try";
const DEFAULT_PORTFOLIO_NAME = "Hungry Picks";

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

function portfolioContainsTarget(
  items: ReturnType<typeof usePortfolioStore.getState>["items"],
  portfolioId: string,
  target: DetailSaveTarget,
) {
  return (items[portfolioId] ?? []).some((item) => {
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

  const addToPortfolio = useCallback(async () => {
    if (isAddingToPortfolio || !requireAuth()) {
      return;
    }

    setIsAddingToPortfolio(true);
    try {
      let portfolioState = usePortfolioStore.getState();
      if (!portfolioState.isLoaded) {
        await portfolioState.loadPortfolios({ userId: profile.id });
        portfolioState = usePortfolioStore.getState();
      }

      // Quick save only ever uses its own private "Hungry Picks" list: falling back to the
      // first owned portfolio could add the item to a published public ranking.
      let portfolio = portfolioState.portfolios.find(
        (entry) => entry.ownerId === profile.id && entry.name === DEFAULT_PORTFOLIO_NAME,
      );
      if (!portfolio) {
        portfolio = await portfolioState.createPortfolio({
          name: DEFAULT_PORTFOLIO_NAME,
          description: "Quick saves from dish and stall detail pages.",
          type: "recommendation",
          visibility: "private",
        });
      }

      if (!usePortfolioStore.getState().items[portfolio.id]) {
        await usePortfolioStore.getState().loadPortfolioItems(portfolio.id);
      }

      if (portfolioContainsTarget(usePortfolioStore.getState().items, portfolio.id, target)) {
        showToast({
          message: `${target.label} is already in ${portfolio.name}.`,
          tone: "info",
        });
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
    } catch (error) {
      showToast({
        message: isDuplicateError(error)
          ? `${target.label} is already saved to that portfolio.`
          : "Could not add this to your portfolio.",
        tone: isDuplicateError(error) ? "info" : "error",
      });
    } finally {
      setIsAddingToPortfolio(false);
    }
  }, [isAddingToPortfolio, profile.id, requireAuth, showToast, target]);

  return {
    addToChecklist,
    addToPortfolio,
    isAddingToChecklist,
    isAddingToPortfolio,
  };
}

interface DetailSaveActionsCardProps {
  title: string;
  body: string;
  onAddToChecklist: () => void;
  onAddToPortfolio: () => void;
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
        <Button
          label="Add to Portfolio"
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
      </View>
    </Card>
  );
}
