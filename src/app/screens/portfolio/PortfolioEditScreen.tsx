import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { PortfolioTypeSelector, PortfolioVisibilitySelector } from "@/components/portfolio";
import { AppText, Button, Card, Input } from "@/components/ui";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useHungryTheme } from "@/theme";
import type { PortfolioType, PortfolioVisibility } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioEdit">;

export function PortfolioEditScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const portfolioId = route.params.portfolioId;
  const { portfolios, refreshPortfolio, updatePortfolio, conflicts, clearConflict } =
    usePortfolioStore();
  const portfolio = portfolios.find((entry) => entry.id === portfolioId);
  const conflict = conflicts[portfolioId];
  const [name, setName] = useState(portfolio?.name ?? "");
  const [description, setDescription] = useState(portfolio?.description ?? "");
  const [type, setType] = useState<PortfolioType>(portfolio?.type ?? "recommendation");
  const [visibility, setVisibility] = useState<PortfolioVisibility>(
    portfolio?.visibility ?? "private",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load just this list: an unfiltered, capped read could miss it.
    void refreshPortfolio(portfolioId).catch((error) =>
      console.error("Failed to load list:", error),
    );
  }, [portfolioId, refreshPortfolio]);

  useEffect(() => {
    if (!portfolio) return;
    setName(portfolio.name);
    setDescription(portfolio.description ?? "");
    setType(portfolio.type);
    setVisibility(portfolio.visibility);
  }, [portfolio]);

  async function save() {
    if (!portfolio || !name.trim()) return;
    setIsSaving(true);
    try {
      await updatePortfolio(portfolio.id, {
        name,
        description: description.trim() || undefined,
        type,
        visibility,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Portfolio update failed",
        error instanceof Error ? error.message : "Please refresh and try again.",
      );
    } finally {
      setIsSaving(false);
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
          <AppText variant="h1">Edit portfolio</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Update the title, type, and sharing level.
          </AppText>
        </View>
      </View>

      {!portfolio ? (
        <Card>
          <AppText variant="h3">Portfolio not found</AppText>
        </Card>
      ) : (
        <>
          {conflict ? (
            <Card>
              <AppText variant="bodyBold">Latest version loaded</AppText>
              <AppText variant="bodySmall" tone="secondary">
                {conflict.message}
              </AppText>
              <Button
                label="Review latest"
                size="sm"
                fullWidth={false}
                variant="secondary"
                onPress={() => clearConflict(portfolioId)}
              />
            </Card>
          ) : null}
          <Card>
            <Input label="Title" value={name} onChangeText={setName} />
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </Card>
          <Card>
            <AppText variant="bodyBold">Type</AppText>
            <PortfolioTypeSelector value={type} onChange={setType} />
          </Card>
          <Card>
            <AppText variant="bodyBold">Visibility</AppText>
            <PortfolioVisibilitySelector value={visibility} onChange={setVisibility} />
          </Card>
          <Button label="Save changes" loading={isSaving} disabled={!name.trim()} onPress={save} />
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
