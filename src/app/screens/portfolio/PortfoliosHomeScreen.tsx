import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Plus, Search } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { PortfolioCard } from "@/components/portfolio";
import { AppText, Button, Card, Input } from "@/components/ui";
import { useShallow } from "zustand/react/shallow";

import { resolveListItemCount } from "@/features/checklistPortfolio/listLabels";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { usePortfolioStore, type PortfolioListScope } from "@/store/usePortfolioStore";
import { useHungryTheme } from "@/theme";
import type { Portfolio } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfoliosHome">;
type PortfolioTab = PortfolioListScope;

const TAB_LABELS: Record<PortfolioTab, string> = {
  mine: "My",
  shared: "Shared with me",
  following: "Following",
  discover: "Discover",
};

export function PortfoliosHomeScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const [activeTab, setActiveTab] = useState<PortfolioTab>("mine");
  const { portfolios, items, scopeIds, loadPortfolioScope, loadFollowedPortfolios } =
    usePortfolioStore(
      useShallow((state) => ({
        portfolios: state.portfolios,
        items: state.items,
        scopeIds: state.scopeIds,
        loadPortfolioScope: state.loadPortfolioScope,
        loadFollowedPortfolios: state.loadFollowedPortfolios,
      })),
    );
  // Each tab runs its own server query, so a busy Discover feed can't push your lists out.
  const tabIds = scopeIds[activeTab];
  const isLoaded = tabIds !== undefined;
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();
  // A failed load with no cache shows an error with Retry instead of "Loading..." forever.
  const [loadFailed, setLoadFailed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoadFailed(false);
    // Follows load on their own: a failure there must not hide the lists.
    void loadFollowedPortfolios().catch((error) =>
      console.error("Failed to load followed lists:", error),
    );
    try {
      await loadPortfolioScope(activeTab);
    } catch (error) {
      console.error("Failed to load lists:", error);
      trackAnalyticsEvent("list_load_failed", { list_kind: "portfolio" });
      setLoadFailed(true);
    }
  }, [activeTab, loadFollowedPortfolios, loadPortfolioScope]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  const visiblePortfolios = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const byId = new Map(portfolios.map((portfolio) => [portfolio.id, portfolio]));
    return (tabIds ?? [])
      .map((id) => byId.get(id))
      .filter((portfolio): portfolio is Portfolio => Boolean(portfolio))
      .filter((portfolio) => {
        if (!normalizedQuery) return true;
        return `${portfolio.name} ${portfolio.description ?? ""} ${portfolio.type}`
          .toLowerCase()
          .includes(normalizedQuery);
      });
  }, [portfolios, query, tabIds]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top }}
      contentContainerStyle={[styles.content, { gap: spacing[4], padding: spacing[4] }]}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh()} />}
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
          <AppText variant="h1">Your lists</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Curate rankings, trails, and recommendations.
          </AppText>
        </View>
      </View>

      <View style={styles.actionRow}>
        {(Object.keys(TAB_LABELS) as PortfolioTab[]).map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
            accessibilityLabel={`${TAB_LABELS[tab]} lists`}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === tab ? palette.orangeLight : palette.surface,
                borderColor: activeTab === tab ? palette.orange : palette.border,
              },
            ]}
          >
            <AppText variant="bodySmallBold" tone={activeTab === tab ? "accent" : "secondary"}>
              {TAB_LABELS[tab]}
            </AppText>
          </Pressable>
        ))}
      </View>

      <Input
        label="Search your lists"
        placeholder="Search by title, type, or description..."
        value={query}
        onChangeText={setQuery}
        leftIcon={<Search color={palette.textMuted} size={18} />}
      />

      {activeTab === "mine" ? (
        <View style={styles.actionRow}>
          <Button
            label="Create list"
            fullWidth={false}
            leftIcon={<Plus color={palette.textOnOrange} size={18} />}
            onPress={() => navigation.navigate("PortfolioCreate")}
          />
          <Button
            label="Global search"
            fullWidth={false}
            variant="secondary"
            onPress={() => navigation.navigate("PortfolioSearch")}
          />
        </View>
      ) : null}

      {!isLoaded && loadFailed ? (
        <Card>
          <AppText variant="h3">{"Couldn't load lists"}</AppText>
          <AppText variant="body" tone="secondary">
            Check your connection and try again.
          </AppText>
          <Button label="Retry" variant="secondary" onPress={() => void load()} />
        </Card>
      ) : !isLoaded ? (
        <Card>
          <AppText variant="body" tone="secondary">
            Loading lists...
          </AppText>
        </Card>
      ) : visiblePortfolios.length === 0 ? (
        <Card>
          <AppText variant="h3">No lists here yet</AppText>
          <AppText variant="body" tone="secondary">
            {activeTab === "mine"
              ? "Create a list when you want to organise places worth recommending."
              : activeTab === "shared"
                ? "Lists a friend adds you to as a collaborator show up here."
                : "Try another tab or search term."}
          </AppText>
        </Card>
      ) : (
        visiblePortfolios.map((portfolio) => (
          <PortfolioCard
            key={portfolio.id}
            portfolio={portfolio}
            itemCount={resolveListItemCount(portfolio, items[portfolio.id])}
            onPress={() => navigation.navigate("PortfolioDetail", { portfolioId: portfolio.id })}
          />
        ))
      )}
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
  tab: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
