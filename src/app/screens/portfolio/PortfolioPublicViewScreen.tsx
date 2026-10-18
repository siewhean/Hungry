import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { AccessibleImage, AppText, Button, Card } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { PublicPortfolio } from "@/types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "PortfolioPublicView">;

export function PortfolioPublicViewScreen({ navigation, route }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const portfolioId = route.params.portfolioId;
  const { follows, followPortfolio, unfollowPortfolio } = usePortfolioStore();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  // Shared links usually come from someone else, often before the friend has
  // signed in, so read through the public RPC instead of the owner's tables.
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isFollowing = follows[portfolioId] === true;

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    void getHungryService()
      .portfolio.getPublicPortfolio(portfolioId)
      .then((next) => {
        if (mounted) setPortfolio(next);
      })
      .catch(() => {
        if (mounted) setPortfolio(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [portfolioId]);

  const handleFollow = () => {
    // Sign-in is asked only when the friend wants to keep the list.
    if (!isAuthenticated) {
      setReturnRoute({ name: "PortfolioPublicView", params: { portfolioId } });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }
    void (isFollowing ? unfollowPortfolio(portfolioId) : followPortfolio(portfolioId));
  };

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
          <AppText variant="h1">Hungry list</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Shared with you
          </AppText>
        </View>
      </View>

      {!portfolio ? (
        <Card>
          <AppText variant="h3">{isLoading ? "Loading list…" : "List not found"}</AppText>
          {!isLoading ? (
            <AppText variant="bodySmall" tone="secondary">
              It may be private now or no longer on Hungry.
            </AppText>
          ) : null}
        </Card>
      ) : (
        <>
          <Card>
            <AppText variant="h2">{portfolio.name}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {[
                `${portfolio.items.length} pick${portfolio.items.length === 1 ? "" : "s"}`,
                portfolio.ownerDisplayName ? `by ${portfolio.ownerDisplayName}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </AppText>
            {portfolio.description ? (
              <AppText variant="body" tone="secondary">
                {portfolio.description}
              </AppText>
            ) : null}
            <Button
              label={isFollowing ? "Saved" : "Save this list"}
              variant={isFollowing ? "secondary" : "primary"}
              onPress={handleFollow}
            />
          </Card>

          {portfolio.items.map((item, index) => (
            <Pressable
              key={`${item.dishId ?? item.stallId}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name}`}
              onPress={() => {
                if (item.dishId) navigation.navigate("DishDetail", { dishId: item.dishId });
                else if (item.stallId)
                  navigation.navigate("StallDetail", { venueId: item.stallId });
              }}
            >
              <Card style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
                {item.imageUrl ? (
                  <AccessibleImage
                    source={{ uri: item.imageUrl }}
                    style={{ borderRadius: radii.sm, height: 64, width: 64 }}
                    contentFit="cover"
                    decorative
                  />
                ) : (
                  <NoDishPhoto
                    dishName={item.name}
                    style={{ borderRadius: radii.sm, height: 64, width: 64 }}
                    iconSize={22}
                  />
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyBold" numberOfLines={1}>
                    #{index + 1} {item.name}
                  </AppText>
                  {item.itemType === "dish" ? (
                    <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                      {[
                        item.stallName,
                        item.price !== undefined ? `S$${item.price.toFixed(2)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </AppText>
                  ) : null}
                  {item.publicNotes ? (
                    <AppText variant="bodySmall" tone="secondary">
                      {item.publicNotes}
                    </AppText>
                  ) : null}
                </View>
              </Card>
            </Pressable>
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
