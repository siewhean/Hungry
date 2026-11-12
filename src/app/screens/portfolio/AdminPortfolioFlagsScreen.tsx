import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ShieldCheck, Trash2 } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Card } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useHungryTheme } from "@/theme";
import type { PortfolioFlag } from "@/types/domain";
import { AppSymbol } from "@/components/ui/AppSymbol";
import { reportError } from "@/lib/monitoring/reportError";

type Props = NativeStackScreenProps<RootStackParamList, "AdminPortfolioFlags">;

export function AdminPortfolioFlagsScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const [flags, setFlags] = useState<PortfolioFlag[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function loadFlags() {
    setIsLoading(true);
    try {
      const nextFlags = await getHungryService().portfolio.getPortfolioFlags({ status: "pending" });
      setFlags(nextFlags);
    } catch (error) {
      reportError(error, { screen: "AdminPortfolioFlags", action: "load_flags" });
    } finally {
      setIsLoading(false);
    }
  }

  async function resolve(flagId: string, resolution: "dismissed" | "removed") {
    try {
      await getHungryService().portfolio.resolvePortfolioFlag(flagId, resolution);
    } catch (error) {
      reportError(error, { screen: "AdminPortfolioFlags", action: "resolve_flag" });
      Alert.alert("Couldn't resolve report", "Please try again.");
      return;
    }
    await loadFlags();
  }

  // Remove takes the whole list down (private and unpublished), so confirm first.
  function confirmRemove(flagId: string) {
    Alert.alert(
      "Remove this list?",
      "The list becomes private and unpublished, and its other reports are closed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void resolve(flagId, "removed") },
      ],
    );
  }

  useEffect(() => {
    void loadFlags();
  }, []);

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
          <AppSymbol name="back" size={22} weight="medium" color={palette.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="h1">Portfolio flags</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Review public portfolio reports.
          </AppText>
        </View>
      </View>

      <Button label="Refresh" loading={isLoading} variant="secondary" onPress={loadFlags} />

      {flags.length === 0 ? (
        <Card>
          <AppText variant="h3">No pending flags</AppText>
          <AppText variant="body" tone="secondary">
            New reports appear here for moderation review.
          </AppText>
        </Card>
      ) : (
        flags.map((flag) => (
          <Card key={flag.id}>
            <AppText variant="bodyBold">{flag.reason}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              Portfolio {flag.portfolioId} · Reporter {flag.reporterId}
            </AppText>
            {flag.details ? (
              <AppText variant="bodySmall" tone="secondary">
                {flag.details}
              </AppText>
            ) : null}
            <View style={styles.actionRow}>
              <Button
                label="Dismiss"
                size="sm"
                fullWidth={false}
                variant="secondary"
                leftIcon={
                  <AppSymbol
                    name="checkmark.shield"
                    fallback={ShieldCheck}
                    size={16}
                    color={palette.text}
                  />
                }
                onPress={() => resolve(flag.id, "dismissed")}
              />
              <Button
                label="View list"
                size="sm"
                fullWidth={false}
                variant="secondary"
                onPress={() =>
                  navigation.navigate("PortfolioPublicView", { portfolioId: flag.portfolioId })
                }
              />
              <Button
                label="Remove"
                size="sm"
                fullWidth={false}
                variant="destructive"
                leftIcon={
                  <AppSymbol name="trash" fallback={Trash2} size={16} color={palette.textOnDark} />
                }
                onPress={() => confirmRemove(flag.id)}
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionRow: {
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
});
