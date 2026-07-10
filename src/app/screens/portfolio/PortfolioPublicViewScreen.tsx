import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Card } from "@/components/ui";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "PortfolioPublicView">;

export function PortfolioPublicViewScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const portfolioId = route.params.portfolioId;
  const {
    portfolios,
    items,
    follows,
    loadPortfolios,
    loadPortfolioItems,
    followPortfolio,
    unfollowPortfolio,
  } = usePortfolioStore();
  const portfolio = portfolios.find((entry) => entry.id === portfolioId);
  const portfolioItems = items[portfolioId] ?? [];
  const isFollowing = follows[portfolioId] === true;

  useEffect(() => {
    void loadPortfolios();
    void loadPortfolioItems(portfolioId);
  }, [loadPortfolioItems, loadPortfolios, portfolioId]);

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
            Public portfolio view
          </AppText>
        </View>
      </View>

      {!portfolio ? (
        <Card>
          <AppText variant="h3">Portfolio not found</AppText>
        </Card>
      ) : (
        <>
          <Card>
            <AppText variant="h2">{portfolio.name}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {portfolio.type} · {portfolio.visibility} · {portfolioItems.length} item
              {portfolioItems.length === 1 ? "" : "s"}
            </AppText>
            {portfolio.description ? (
              <AppText variant="body" tone="secondary">
                {portfolio.description}
              </AppText>
            ) : null}
            <Button
              label={isFollowing ? "Following" : "Follow portfolio"}
              variant={isFollowing ? "secondary" : "primary"}
              onPress={() =>
                isFollowing ? unfollowPortfolio(portfolio.id) : followPortfolio(portfolio.id)
              }
            />
          </Card>

          {portfolioItems.map((item, index) => (
            <Card key={item.id}>
              <AppText variant="bodyBold">
                #{index + 1} {item.dishId ?? item.stallId ?? "Portfolio item"}
              </AppText>
              {item.publicNotes ? (
                <AppText variant="bodySmall" tone="secondary">
                  {item.publicNotes}
                </AppText>
              ) : null}
            </Card>
          ))}
        </>
      )}
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
