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
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfoliosHome">;
type PortfolioTab = "mine" | "following" | "discover";

const TAB_LABELS: Record<PortfolioTab, string> = {
  mine: "My",
  following: "Following",
  discover: "Discover",
};

export function PortfoliosHomeScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const { portfolios, items, follows, isLoaded, loadPortfolios, loadFollowedPortfolios } =
    usePortfolioStore(
      useShallow((state) => ({
        portfolios: state.portfolios,
        items: state.items,
        follows: state.follows,
        isLoaded: state.isLoaded,
        loadPortfolios: state.loadPortfolios,
        loadFollowedPortfolios: state.loadFollowedPortfolios,
      })),
    );
  const [activeTab, setActiveTab] = useState<PortfolioTab>("mine");
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
      await loadPortfolios();
    } catch (error) {
      console.error("Failed to load portfolios:", error);
      trackAnalyticsEvent("list_load_failed", { list_kind: "portfolio" });
      setLoadFailed(true);
    }
  }, [loadFollowedPortfolios, loadPortfolios]);

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
    return portfolios.filter((portfolio) => {
      if (activeTab === "mine" && portfolio.ownerId !== profile.id) return false;
      if (activeTab === "following" && !follows[portfolio.id]) return false;
      if (activeTab === "discover" && portfolio.ownerId === profile.id) return false;
      if (!normalizedQuery) return true;
      return `${portfolio.name} ${portfolio.description ?? ""} ${portfolio.type}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeTab, follows, portfolios, profile.id, query]);

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
          <AppText variant="h1">Hungry Portfolios</AppText>
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
            accessibilityLabel={`${TAB_LABELS[tab]} portfolios`}
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
        label="Search portfolios"
        placeholder="Search by title, type, or description..."
        value={query}
        onChangeText={setQuery}
        leftIcon={<Search color={palette.textMuted} size={18} />}
      />

      {activeTab === "mine" ? (
        <View style={styles.actionRow}>
          <Button
            label="Create portfolio"
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
          <AppText variant="h3">{"Couldn't load portfolios"}</AppText>
          <AppText variant="body" tone="secondary">
            Check your connection and try again.
          </AppText>
          <Button label="Retry" variant="secondary" onPress={() => void load()} />
        </Card>
      ) : !isLoaded ? (
        <Card>
          <AppText variant="body" tone="secondary">
            Loading portfolios...
          </AppText>
        </Card>
      ) : visiblePortfolios.length === 0 ? (
        <Card>
          <AppText variant="h3">No portfolios here yet</AppText>
          <AppText variant="body" tone="secondary">
            {activeTab === "mine"
              ? "Create a Hungry Portfolio when you want to organise places worth recommending."
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
