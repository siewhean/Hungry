import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Search } from "lucide-react-native";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Card, Input } from "@/components/ui";
import {
  PORTFOLIO_TYPE_LABELS,
  PORTFOLIO_VISIBILITY_LABELS,
} from "@/features/checklistPortfolio/listLabels";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useHungryTheme } from "@/theme";
import type { Portfolio } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioSearch">;

export function PortfolioSearchScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const searchPortfolios = usePortfolioStore((state) => state.searchPortfolios);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Portfolio[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  async function runSearch() {
    setIsSearching(true);
    setSearchFailed(false);
    try {
      const nextResults = await searchPortfolios(query);
      setResults(nextResults);
      setHasSearched(true);
    } catch (error) {
      console.error("Failed to search lists:", error);
      setSearchFailed(true);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: Math.max(insets.top, spacing[4]) }}
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
          <AppText variant="h1">Search lists</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Find public lists by title, notes, or type.
          </AppText>
        </View>
      </View>

      <Card>
        <Input
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search public lists..."
          leftIcon={<Search color={palette.textMuted} size={18} />}
          onSubmitEditing={runSearch}
        />
        <Button label="Search" loading={isSearching} onPress={runSearch} />
      </Card>

      {searchFailed ? (
        <Card>
          <AppText variant="h3">{"Couldn't search lists"}</AppText>
          <AppText variant="body" tone="secondary">
            Check your connection and try again.
          </AppText>
        </Card>
      ) : null}

      {hasSearched && !searchFailed && results.length === 0 ? (
        <Card>
          <AppText variant="h3">No lists found</AppText>
          <AppText variant="body" tone="secondary">
            Try a broader food or cuisine term.
          </AppText>
        </Card>
      ) : null}

      {results.map((portfolio) => (
        <Pressable
          key={portfolio.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${portfolio.name}`}
          onPress={() => navigation.navigate("PortfolioDetail", { portfolioId: portfolio.id })}
        >
          <Card>
            <AppText variant="bodyBold">{portfolio.name}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {PORTFOLIO_TYPE_LABELS[portfolio.type] ?? portfolio.type} ·{" "}
              {PORTFOLIO_VISIBILITY_LABELS[portfolio.visibility] ?? portfolio.visibility}
            </AppText>
            {portfolio.description ? (
              <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>
                {portfolio.description}
              </AppText>
            ) : null}
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
