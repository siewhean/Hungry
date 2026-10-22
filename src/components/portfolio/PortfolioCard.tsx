import { Pressable, StyleSheet, View } from "react-native";

import { AppText, Card } from "@/components/ui";
import type { Portfolio } from "@/types/domain";

interface PortfolioCardProps {
  portfolio: Portfolio;
  itemCount?: number;
  onPress: () => void;
}

function getPortfolioSubtitle(portfolio: Portfolio, itemCount: number | undefined): string {
  const visibility = portfolio.visibility === "followers_only" ? "Followers" : portfolio.visibility;
  return `${portfolio.type} · ${visibility}${itemCount === undefined ? "" : ` · ${itemCount} item${itemCount === 1 ? "" : "s"}`}`;
}

export function PortfolioCard({ portfolio, itemCount, onPress }: PortfolioCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${portfolio.name}`}
      onPress={onPress}
    >
      <Card>
        <View style={styles.cardHeader}>
          <View style={styles.copy}>
            <AppText variant="bodyBold">{portfolio.name}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {getPortfolioSubtitle(portfolio, itemCount)}
            </AppText>
          </View>
        </View>
        {portfolio.description ? (
          <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>
            {portfolio.description}
          </AppText>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  copy: {
    flex: 1,
  },
});
