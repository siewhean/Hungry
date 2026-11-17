import { usePreventRemove } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
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
  const insets = useSafeAreaInsets();
  const { palette, spacing } = useHungryTheme();
  const portfolioId = route.params.portfolioId;
  const { portfolios, loadPortfolios, updatePortfolio, conflicts, clearConflict } =
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

  const dirty =
    Boolean(portfolio) &&
    (name !== portfolio?.name ||
      description !== (portfolio?.description ?? "") ||
      type !== portfolio?.type ||
      visibility !== portfolio?.visibility);
  usePreventRemove(dirty && !isSaving, ({ data }) => {
    Alert.alert("Discard portfolio changes?", "Your unsaved changes will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  const initializedPortfolio = useRef<string | undefined>(portfolio?.id);
  useEffect(() => {
    void loadPortfolios().catch((error: unknown) =>
      Alert.alert(
        "Could not load saved tools",
        error instanceof Error ? error.message : "Please retry.",
      ),
    );
  }, [loadPortfolios]);

  useEffect(() => {
    if (!portfolio || initializedPortfolio.current === portfolio.id) return;
    initializedPortfolio.current = portfolio.id;
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
        description: description.trim() || null,
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
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top }}
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
              <AppText variant="bodyBold">Remote changes detected; your edits are kept</AppText>
              <AppText variant="bodySmall" tone="secondary">
                {conflict.message}
              </AppText>
              <AppText variant="bodySmall">Server title: {portfolio.name}</AppText>
              <AppText variant="bodySmall">
                Server description: {portfolio.description || "None"}
              </AppText>
              <Button
                label="Keep my edits against this version"
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
